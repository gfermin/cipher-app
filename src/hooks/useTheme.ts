'use client'
import { useEffect } from 'react'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { updateProfile } from '@/services/authService'
import type { Theme } from '@/types/app'

export function useTheme() {
  const { theme, setTheme } = useThemeStore()
  const { user, setUser } = useAuthStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Sync theme from profile when auth first resolves or profile is refreshed.
  // Only fires when user.profile.app_theme actually changes value (string compare),
  // so it doesn't revert a local change made in the same session — as long as
  // changeTheme keeps authStore in sync (see below).
  useEffect(() => {
    if (user?.profile?.app_theme) {
      const profileTheme = user.profile.app_theme as Theme
      if (profileTheme !== theme) {
        setTheme(profileTheme)
      }
    }
  }, [user?.profile?.app_theme]) // eslint-disable-line react-hooks/exhaustive-deps

  const changeTheme = async (newTheme: Theme) => {
    if (!user) return
    const prevTheme = theme
    const prevProfile = user.profile

    // Apply immediately — both stores must be updated together so the sync
    // effect above sees profile.app_theme === themeStore.theme and does nothing.
    setTheme(newTheme)
    setUser({ ...user, profile: { ...user.profile, app_theme: newTheme } })

    try {
      await updateProfile({ app_theme: newTheme })
    } catch {
      // DB save failed — revert both stores so the UI stays consistent
      setTheme(prevTheme)
      setUser({ ...user, profile: prevProfile })
    }
  }

  return { theme, changeTheme }
}
