'use client'
import { useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { getSession } from '@/services/authService'

// If the session check hangs (e.g. stale cookie + Supabase unreachable), this
// races it with a 4-second timeout so the app never freezes on "Loading…".
function sessionWithTimeout(): Promise<Awaited<ReturnType<typeof getSession>>> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
  return Promise.race([getSession(), timeout])
}

export function useAuth() {
  const { user, isLoading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    let mounted = true
    const supabase = getSupabaseClient()

    sessionWithTimeout()
      .then((u) => { if (mounted) { setUser(u); setLoading(false) } })
      .catch(() => { if (mounted) setLoading(false) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const u = await getSession()
        if (mounted) setUser(u)
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [setUser, setLoading])

  return { user, isLoading }
}
