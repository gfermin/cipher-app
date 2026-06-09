import { getSupabaseClient } from '@/lib/supabase/client'
import type { CodeMetadata } from '@/types/app'

const FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1'

async function getBearerToken(): Promise<string> {
  const { data } = await getSupabaseClient().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

async function callFunction(
  name: string,
  token: string,
  body?: Record<string, unknown>
): Promise<Response> {
  return fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── Code Metadata ─────────────────────────────────────────────────

export async function getCodeMetadata(): Promise<CodeMetadata | null> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('get_my_code_metadata')
  if (error) return null
  return data && data.length > 0 ? (data[0] as CodeMetadata) : null
}

// ── Code Generation ───────────────────────────────────────────────

// Called after sign-in. Generates (or recovers) the user's contact code.
// Also regenerates if the existing code has already expired, since the
// rotation cron may not have run yet.
// Non-throwing: generation failure is logged but does not block sign-in.
export async function ensureCodeExists(): Promise<void> {
  const meta = await getCodeMetadata()
  // Skip only when a code exists, has an encrypted blob, AND hasn't expired
  if (meta?.has_code && meta.is_encrypted && meta.expires_at && new Date(meta.expires_at) > new Date()) {
    return
  }

  const token = await getBearerToken()
  const res = await callFunction('generate-contact-code', token)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'generate_failed')
  }
}

// ── Code Reveal ───────────────────────────────────────────────────

// Re-authenticates with the user's password (proof of identity), then
// fetches and decrypts the plaintext code from the reveal Edge Function.
// Returns { code, expires_at }.
export async function revealCode(password: string): Promise<{ code: string; expires_at: string | null }> {
  const sb = getSupabaseClient()

  const { data: { user } } = await sb.auth.getUser()
  if (!user?.email) throw new Error('Not authenticated')

  // Re-auth proves the user knows their password (shoulder-surfing guard)
  const { error: reAuthError } = await sb.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (reAuthError) throw new Error('incorrect_password')

  // Fresh token from the re-auth session
  const token = await getBearerToken()
  const res = await callFunction('reveal-contact-code', token)

  if (res.status === 409) throw new Error('code_reset_required')
  if (res.status === 404) throw new Error('no_code')
  if (!res.ok) throw new Error('reveal_failed')

  return res.json()
}

// ── Contact Code Lookup ───────────────────────────────────────────
// Routes through the contact-lookup Edge Function which enforces the
// per-user rate limit (5/min, 20/hr) before calling lookup_contact_code.
// Returns an opaque lookup token UUID valid for 5 minutes.
export async function lookupContactCode(code: string): Promise<string> {
  const token = await getBearerToken()
  const res = await callFunction('contact-lookup', token, { code })
  if (res.status === 429) throw new Error('rate_limited')
  if (res.status === 404) throw new Error('invalid_code')
  if (!res.ok) throw new Error('lookup_failed')
  const body = await res.json()
  return body.token as string
}
