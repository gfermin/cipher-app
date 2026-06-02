'use client'
import { useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { getSession } from '@/services/authService'

export function useAuth() {
  const { user, isLoading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    let mounted = true
    const supabase = getSupabaseClient()

    getSession().then((u) => {
      if (mounted) { setUser(u); setLoading(false) }
    })

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
