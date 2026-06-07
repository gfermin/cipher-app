// generate-contact-code
// Called by the client immediately after a successful sign-in when no code
// exists yet (new accounts, or recovery after a failed initial generation).
//
// Flow:
//   1. Verify caller's JWT → extract user_id
//   2. Mint a fresh contact code via service_role (returns plaintext once)
//   3. Encrypt with AES-256-GCM using CIPHER_CODE_SECRET
//   4. Persist the encrypted blob via store_code_encrypted RPC
//
// Required Supabase secrets:
//   supabase secrets set CIPHER_CODE_SECRET=$(openssl rand -hex 32)

import { createClient } from 'npm:@supabase/supabase-js@2'
import { encryptCode } from '../_shared/crypto.ts'

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

  // Verify caller identity via their JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS })
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Mint: generates a new code, stores the hash, returns plaintext once
  const { data: plaintext, error: mintError } = await adminClient.rpc('mint_contact_code', {
    p_user_id: user.id,
  })
  if (mintError || !plaintext) {
    console.error('mint_contact_code failed:', mintError)
    return new Response(JSON.stringify({ error: 'generation_failed' }), { status: 500, headers: CORS })
  }

  // Encrypt and persist the blob
  const encrypted = await encryptCode(plaintext as string, CIPHER_CODE_SECRET)

  const { error: storeError } = await adminClient.rpc('store_code_encrypted', {
    p_user_id: user.id,
    p_encrypted: encrypted,
  })
  if (storeError) {
    console.error('store_code_encrypted failed:', storeError)
    return new Response(JSON.stringify({ error: 'store_failed' }), { status: 500, headers: CORS })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
})
