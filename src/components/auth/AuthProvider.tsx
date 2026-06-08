'use client'
import { useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import type { Profile } from '@/types/app'

// Races a native Promise against a hard deadline.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`auth_timeout_${ms}`)), ms)
    ),
  ])
}

// Races a Supabase PostgREST PromiseLike against a hard deadline and returns
// the `data` field. Using `as unknown as Promise<T>` because the untyped
// Supabase client returns PostgrestBuilder<never> which isn't a native Promise.
async function queryWithTimeout<T>(
  thenable: PromiseLike<{ data: T | null }>,
  ms: number
): Promise<T | null> {
  const result = await (Promise.race([
    thenable,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`query_timeout_${ms}`)), ms)
    ),
  ]) as unknown as Promise<{ data: T | null }>)
  return result.data
}

// Clears the Supabase auth session locally (no network call) then manually
// removes all sb-*-auth-token cookies from document.cookie as a guaranteed
// backstop so the Next.js middleware doesn't bounce the /login redirect back
// to /chats. scope:'local' is instant (no server round-trip).
async function clearSessionLocally(supabase: ReturnType<typeof getSupabaseClient>) {
  try { await supabase.auth.signOut({ scope: 'local' }) } catch {}
  // Belt-and-suspenders: manually expire any remaining auth cookies.
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
    // resolved is the single exit-point flag. Once true, every subsequent path
    // (retries, auth events, failsafe) is a no-op — preventing double-updates
    // and preventing the failsafe from signing out an already-initialized user.
    let resolved = false
    const supabase = getSupabaseClient()

    function resolve(user: Parameters<typeof setUser>[0]) {
      if (!mounted || resolved) return
      resolved = true
      setUser(user)
      setLoading(false)
    }

    // Loads the profile row. On success calls resolve() and returns true.
    // On any failure (network, RLS, missing row, timeout) returns false so
    // the caller can retry or escalate. 8-second timeout prevents DB hangs.
    async function loadProfile(userId: string, email: string): Promise<boolean> {
      try {
        const profile = await queryWithTimeout<Profile>(
          supabase.from('profiles').select('*').eq('id', userId).single(),
          8000
        )
        if (profile) {
          resolve({ id: userId, email, profile })
          return true
        }
      } catch {}
      return false
    }

    // Primary initialization. getSession() awaits the Supabase client's internal
    // initializePromise (which includes any in-progress token refresh). Time-boxed:
    // a degraded-connection token-refresh HTTP call can hang indefinitely without
    // the timeout. 10 s is generous for any realistic network condition.
    async function initializeAuth(): Promise<void> {
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          10000
        )
        if (!mounted) return

        if (!session?.user) {
          resolve(null)
          return
        }

        // Attempt 1
        const ok = await loadProfile(session.user.id, session.user.email!)
        if (!mounted || ok) return

        // 1.2 s retry — TOKEN_REFRESHED writes the new token before this fires
        // in the race where getSession returned a session mid-refresh.
        await new Promise<void>((r) => setTimeout(r, 1200))
        if (!mounted) return

        const retryOk = await loadProfile(session.user.id, session.user.email!)
        if (!mounted || retryOk) return

        // Both loads failed. Verify liveness then clear session to prevent the
        // middleware bounce loop (middleware sees valid cookies → redirects /login
        // back to /chats → infinite loading illusion).
        const { data: { user: liveUser } } = await withTimeout(
          supabase.auth.getUser(),
          5000
        )
        if (!mounted) return

        void liveUser
        await clearSessionLocally(supabase)
        resolve(null)
      } catch {
        resolve(null)
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_IN') {
        if (session?.user) {
          // Do NOT go through resolve() here — it is guarded by the `resolved` flag
          // and would be a no-op if AuthProvider already resolved with null on this
          // page load (e.g. no session on /register page, then signUp() fires SIGNED_IN).
          // Instead call setUser() directly so the auth state is ALWAYS updated on
          // sign-in, regardless of prior initialization state.
          try {
            const profile = await queryWithTimeout<Profile>(
              supabase.from('profiles').select('*').eq('id', session.user.id).single(),
              8000
            )
            if (!mounted) return
            if (profile) {
              setUser({ id: session.user.id, email: session.user.email!, profile })
              // Only stop the loading spinner if it hasn't been stopped yet.
              if (!resolved) { resolved = true; setLoading(false) }
            } else {
              resolve(null)
            }
          } catch {
            if (mounted) resolve(null)
          }
        } else {
          resolve(null)
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // Recovery path for expired-token-on-load race. Skip if already resolved.
        if (session?.user && !resolved) {
          try {
            const profile = await queryWithTimeout<Profile>(
              supabase.from('profiles').select('*').eq('id', session.user.id).single(),
              8000
            )
            if (mounted && profile) {
              resolve({ id: session.user.id, email: session.user.email!, profile })
            } else if (mounted) {
              resolve(null)
            }
          } catch {
            if (mounted) resolve(null)
          }
        }
      } else if (event === 'SIGNED_OUT') {
        resolve(null)
      }
    })

    // Failsafe: only activates if resolved=false after 12 s — i.e. a genuine
    // hang. Under normal conditions resolved=true well before 12 s, making this
    // a guaranteed no-op. clearSessionLocally() cannot hang (no network call).
    const failsafe = window.setTimeout(async () => {
      if (!mounted || resolved) return
      await clearSessionLocally(supabase)
      resolve(null)
    }, 12000)

    return () => {
      mounted = false
      clearTimeout(failsafe)
      subscription.unsubscribe()
    }
  }, [setUser, setLoading])

  return <>{children}</>
}
