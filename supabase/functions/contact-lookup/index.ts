// contact-lookup
// Rate-limited Edge Function wrapper around the lookup_contact_code RPC.
//
// The RPC now handles rate limiting internally (5/min, 20/hr) as of
// 005_phase6_security_hardening.sql. This function is still the recommended
// entry point because it provides an auth gateway and a clean HTTP surface,
// but is no longer the sole enforcement layer.
//
// Request: POST { code: string }
// Response 200: { token: string }   — opaque lookup token, valid 5 min
// Response 404: { error: 'invalid_code' }
// Response 429: { error: 'rate_limited' }

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Authenticate ──────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const jwt = authHeader.slice(7)

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Parse body ─────────────────────────────────────────────────
  let code: string
  try {
    const body = await req.json()
    if (!body.code || typeof body.code !== 'string') throw new Error()
    code = (body.code as string).trim().toUpperCase()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Lookup ─────────────────────────────────────────────────────
  // Rate limiting and attempt logging are now handled inside the RPC
  // (005_phase6_security_hardening.sql). The RPC runs as the authenticated
  // user so all SECURITY DEFINER guards (self-lookup, RLS) apply as designed.
  const { data: token, error: lookupError } = await userClient.rpc(
    'lookup_contact_code' as never,
    { p_code: code } as never
  )

  if (lookupError) {
    // rate_limited comes back as a distinct RPC exception message.
    // All other errors (invalid, expired, own code) map to invalid_code
    // to prevent enumeration.
    if (lookupError.message === 'rate_limited') {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
    return new Response(JSON.stringify({ error: 'invalid_code' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
