import { getSupabaseClient } from '@/lib/supabase/client'
import { buildEmailFromUsername } from '@/lib/utils'
import type { AuthUser, Profile } from '@/types/app'

export async function signIn(username: string, password: string): Promise<AuthUser> {
  const sb = getSupabaseClient()
  const email = buildEmailFromUsername(username)

  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Sign in failed')

  const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single()
  if (!profile) throw new Error('Profile not found')

  return { id: data.user.id, email: data.user.email!, profile: profile as Profile }
}

export async function signUp(username: string, password: string): Promise<void> {
  const sb = getSupabaseClient()
  const email = buildEmailFromUsername(username)

  const { error } = await sb.auth.signUp({ email, password, options: { data: { username } } })
  if (error) {
    if (error.message.includes('already registered')) throw new Error('Username is already taken')
    throw new Error(error.message)
  }
}

export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut()
}

export async function getSession(): Promise<AuthUser | null> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) return null

  return { id: user.id, email: user.email!, profile: profile as Profile }
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
