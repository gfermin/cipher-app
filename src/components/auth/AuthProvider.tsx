'use client'
import { useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import type { Profile } from '@/types/app'

// Fetch the profile row with an 8 s hard timeout. Returns null on any failure
// so the caller can decide how to recover (clear session, show error, etc.).
async function fetchProfile(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string
): Promise<Profile | null> {
  try {
    const result = await (Promise.race([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('profile_timeout')), 8000)
      ),
    ]) as unknown as Promise<{ data: Profile | null }>)
    return result?.data ?? null
  } catch {
    return null
  }
}

// Wipes the local Supabase session without a network round-trip, then manually
// expires any sb-*-auth-token cookie chunks so the Next.js middleware stops
// seeing a "valid" session and bouncing /login back to /chats.
async function clearSessionLocally(supabase: ReturnType<typeof getSupabaseClient>) {
  try { await supabase.auth.signOut({ scope: 'local' }) } catch {}
  try {
    document.cookie.split(';').forEach((c) => {
      const name = c.trim().split('=')[0]
      if (name.startsWith('sb-') && name.includes('-auth-token')) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
      }
    })
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    let mounted = true
    // Guards the failsafe — set to true once INITIAL_SESSION fires so we know
    // initialization is complete regardless of whether auth succeeded or failed.
    let initialized = false
    const supabase = getSupabaseClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'INITIAL_SESSION') {
        // This is the definitive initialization event. Supabase fires it exactly
        // once per page load after initializePromise resolves — which means
        // _recoverAndRefresh() has already run and the session is up-to-date
        // (tokens refreshed if they were near/past expiry). Using this event
        // instead of getSession() eliminates the race condition where getSession()
        // can time out mid-refresh, resolve(null) clears the Zustand user, and
        // the middleware bounce loop creates an infinite-loading illusion.
        initialized = true

        if (session?.user) {
          const profile = await fetchProfile(supabase, session.user.id)
          if (!mounted) return

          if (profile) {
            setUser({ id: session.user.id, email: session.user.email!, profile })
            setLoading(false)
          } else {
            // Valid JWT but no profile row — orphaned auth account or DB issue.
            // Clear the session so the middleware doesn't redirect /login → /chats
            // in a bounce loop, then land the user on the login page cleanly.
            await clearSessionLocally(supabase)
            if (mounted) { setUser(null); setLoading(false) }
          }
        } else {
          // No session on this page load — user is unauthenticated.
          setUser(null)
          setLoading(false)
        }
      } else if (event === 'SIGNED_OUT') {
        // Covers explicit sign-out and expired refresh-token removal by auth-js.
        setUser(null)
        setLoading(false)
      }
      // SIGNED_IN:      _recoverAndRefresh() fires this during initializePromise,
      //                 BEFORE INITIAL_SESSION. LoginForm/RegisterForm call setUser()
      //                 directly after sign-in. No action needed here.
      // TOKEN_REFRESHED: AuthUser carries id/email/profile — no session tokens.
      //                  The Supabase client manages token rotation internally.
      //                  No state update needed.
    })

    // Failsafe: if initializePromise hangs indefinitely (no network, Supabase Auth
    // server unreachable), INITIAL_SESSION will never fire. After 15 s we give up,
    // clear the session to prevent the middleware bounce, and unblock the UI.
    // Under normal conditions initialized=true well before 15 s — this is a no-op.
    const failsafe = window.setTimeout(async () => {
      if (!mounted || initialized) return
      await clearSessionLocally(supabase)
      if (mounted) { initialized = true; setUser(null); setLoading(false) }
    }, 15000)

    return () => {
      mounted = false
      clearTimeout(failsafe)
      subscription.unsubscribe()
    }
  }, [setUser, setLoading])

  return <>{children}</>
}
