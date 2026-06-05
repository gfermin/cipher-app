'use client'
import { create } from 'zustand'
import type { Toast, VaultState } from '@/types/app'
import { generateId } from '@/lib/utils'

interface UIState {
  toasts: Toast[]
  vault: VaultState
  chatSettingsOpen: boolean
  imageViewerUrl: string | null
  isMobileChatOpen: boolean
  newChatId: string | null

  showToast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: string) => void
  setVault: (state: Partial<VaultState>) => void
  setChatSettings: (open: boolean) => void
  setImageViewer: (url: string | null) => void
  setMobileChatOpen: (open: boolean) => void
  setNewChatId: (chatId: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  vault: { isUnlocked: false, chatId: null, vaultToken: null },
  chatSettingsOpen: false,
  imageViewerUrl: null,
  isMobileChatOpen: false,
  newChatId: null,

  showToast: (message, type = 'info') => {
    const id = generateId()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200)
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setVault: (state) =>
    set((s) => ({ vault: { ...s.vault, ...state } })),

  setChatSettings: (chatSettingsOpen) => set({ chatSettingsOpen }),

  setImageViewer: (imageViewerUrl) => set({ imageViewerUrl }),

  setMobileChatOpen: (isMobileChatOpen) => set({ isMobileChatOpen }),

  setNewChatId: (newChatId) => set({ newChatId }),
}))
