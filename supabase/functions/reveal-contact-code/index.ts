// reveal-contact-code
// Returns the plaintext contact code for the authenticated user.
// The client MUST re-authenticate (signInWithPassword) before calling
// this function — the resulting fresh JWT is the proof of password knowledge.
//
// Flow:
//   1. Verify caller's JWT → confirms re-auth happened client-side
//   2. Fetch the encrypted blob via get_my_code_encrypted() RPC
//   3. Decrypt with CIPHER_CODE_SECRET
//   4. Return { code, expires_at }
//
// The plaintext never touches the database; this is the only moment it
// exists unmasked after initial generation.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { decryptCode } from '../_shared/crypto.ts'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY        = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CIPHER_CODE_SECRET       = Deno.env.get('CIPHER_CODE_SECRET')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS })
  }

  // Verify caller — this JWT must be freshly issued (client re-authed with password)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS })
  }

  // Fetch the encrypted blob and expiry using service_role to bypass RLS complexity
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: encrypted, error: fetchError } = await userClient.rpc('get_my_code_encrypted')
  if (fetchError) {
    console.error('get_my_code_encrypted failed:', fetchError)
    return new Response(JSON.stringify({ error: 'fetch_failed' }), { status: 500, headers: CORS })
  }
  if (!encrypted) {
    return new Response(JSON.stringify({ error: 'no_code' }), { status: 404, headers: CORS })
  }

  // Fetch expiry for display
  const { data: meta } = await userClient.rpc('get_my_code_metadata')
  const expiresAt = Array.isArray(meta) && meta.length > 0 ? meta[0].expires_at : null

  let plaintext: string
  try {
    plaintext = await decryptCode(encrypted as string, CIPHER_CODE_SECRET)
  } catch {
    console.error('Decryption failed for user:', user.id)
    // Secret mismatch or corrupt blob — trigger a regen
    await adminClient.rpc('mint_contact_code', { p_user_id: user.id })
    return new Response(JSON.stringify({ error: 'code_reset_required' }), { status: 409, headers: CORS })
  }

  return new Response(JSON.stringify({ code: plaintext, expires_at: expiresAt }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
})
