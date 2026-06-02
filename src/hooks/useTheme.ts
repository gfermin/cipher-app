'use client'
import { useEffect } from 'react'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { updateProfile } from '@/services/authService'
import type { Theme } from '@/types/app'

export function useTheme() {
  const { theme, setTheme } = useThemeStore()
  const { user } = useAuthStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Sync from user profile on mount
  useEffect(() => {
    if (user?.profile?.app_theme) {
      const profileTheme = user.profile.app_theme as Theme
      if (profileTheme !== theme) {
        setTheme(profileTheme)
      }
    }
  }, [user?.profile?.app_theme]) // eslint-disable-line react-hooks/exhaustive-deps

  const changeTheme = async (newTheme: Theme) => {
    setTheme(newTheme)
    if (user) {
      await updateProfile({ app_theme: newTheme }).catch(() => {})
    }
  }

  return { theme, changeTheme }
}
