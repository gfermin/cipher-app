import { getSupabaseClient } from '@/lib/supabase/client'
import { buildEmailFromUsername } from '@/lib/utils'
import { ensureCodeExists } from '@/services/contactCodeService'
import type { AuthUser, Profile } from '@/types/app'

export async function signIn(username: string, password: string): Promise<AuthUser> {
  const sb = getSupabaseClient()
  const email = buildEmailFromUsername(username)

  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Sign in failed')

  const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single()
  if (!profile) throw new Error('Profile not found')

  // Non-blocking: ensure the contact code exists (generates one for new accounts,
  // or recovers if the initial generation failed after a previous sign-up).
  ensureCodeExists().catch(() => {})

  return { id: data.user.id, email: data.user.email!, profile: profile as Profile }
}

// Returns the fully-loaded AuthUser when Supabase creates a session immediately
// (email confirmation disabled). Returns null when email confirmation is required
// so the caller can redirect to the login page instead.
export async function signUp(username: string, password: string): Promise<AuthUser | null> {
  const sb = getSupabaseClient()
  const email = buildEmailFromUsername(username)

  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } })
  if (error) {
    if (error.message.includes('already registered')) throw new Error('Username is already taken')
    throw new Error(error.message)
  }

  // Session is set immediately when email confirmation is disabled.
  // Fetch the profile here so the caller can populate the auth store without
  // relying on the SIGNED_IN event (which is ignored when AuthProvider has
  // already resolved with null on this page load).
  if (data.session && data.user) {
    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()
    if (profile) {
      ensureCodeExists().catch(() => {})
      return { id: data.user.id, email: data.user.email!, profile: profile as Profile }
    }
  }

  return null
}

export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut()
}

export async function getSession(): Promise<AuthUser | null> {
  try {
    const sb = getSupabaseClient()
    // getSession() reads the local cookie without a network round-trip.
    // May still trigger a background refresh; errors are caught below.
    const { data: { session }, error } = await sb.auth.getSession()
    if (error || !session?.user) return null

    const user = session.user
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return null

    return { id: user.id, email: user.email!, profile: profile as Profile }
  } catch {
    return null
  }
}

export async function deleteAccount(): Promise<void> {
  const res = await fetch('/api/account/delete', { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Account deletion failed')
  }
  await getSupabaseClient().auth.signOut().catch(() => {})
}

export async function verifyAccountPassword(password: string): Promise<boolean> {
  try {
    const sb = getSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user?.email) return false
    const { error } = await sb.auth.signInWithPassword({ email: user.email, password })
    return !error
  } catch {
    return false
  }
}

export async function updateProfile(updates: { display_name?: string | null; app_theme?: string }): Promise<void> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await sb
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) throw new Error(error.message)
}
