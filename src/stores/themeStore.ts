'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme } from '@/types/app'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme)
        set({ theme })
      },
    }),
    { name: 'cipher-theme' }
  )
)
