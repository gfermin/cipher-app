'use client'
import { useAuthStore } from '@/stores/authStore'

// AuthProvider (in RootLayout) owns the Supabase onAuthStateChange subscription
// and populates this store. This hook is a pure read — no side effects.
export function useAuth() {
  const { user, isLoading } = useAuthStore()
  return { user, isLoading }
}
