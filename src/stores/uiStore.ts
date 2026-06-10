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
  chatLockEnabled: boolean
  chatLockInitialized: boolean
  lockedChats: Set<string>
  hiddenBoardOpen: boolean
  pendingVaultSetupChatId: string | null
  chatLockSession: { verifiedAt: number } | null

  showToast: (message: string, type?: Toast['type']) => void
  setChatLockSession: (session: { verifiedAt: number } | null) => void
  setChatLockInitialized: (initialized: boolean) => void
  dismissToast: (id: string) => void
  setVault: (state: Partial<VaultState>) => void
  setChatSettings: (open: boolean) => void
  setImageViewer: (url: string | null) => void
  setMobileChatOpen: (isMobileChatOpen: boolean) => void
  setNewChatId: (chatId: string | null) => void
  setChatLockEnabled: (enabled: boolean) => void
  lockChat: (chatId: string) => void
  unlockChat: (chatId: string) => void
  lockAllChats: (chatIds: string[]) => void
  openHiddenBoard: () => void
  closeHiddenBoard: () => void
  setPendingVaultSetupChatId: (chatId: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  vault: { isUnlocked: false, chatId: null, vaultToken: null },
  chatSettingsOpen: false,
  imageViewerUrl: null,
  isMobileChatOpen: false,
  newChatId: null,
  chatLockEnabled: false,
  chatLockInitialized: false,
  lockedChats: new Set<string>(),
  hiddenBoardOpen: false,
  pendingVaultSetupChatId: null,
  chatLockSession: null,

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

  setChatLockEnabled: (chatLockEnabled) => set({ chatLockEnabled }),

  lockChat: (chatId) =>
    set((s) => {
      const next = new Set(s.lockedChats)
      next.add(chatId)
      return { lockedChats: next }
    }),

  unlockChat: (chatId) =>
    set((s) => {
      const next = new Set(s.lockedChats)
      next.delete(chatId)
      return { lockedChats: next }
    }),

  lockAllChats: (chatIds) =>
    set({ lockedChats: new Set(chatIds) }),

  openHiddenBoard: () => set({ hiddenBoardOpen: true }),
  closeHiddenBoard: () => set({ hiddenBoardOpen: false }),
  setPendingVaultSetupChatId: (pendingVaultSetupChatId) => set({ pendingVaultSetupChatId }),
  setChatLockSession: (chatLockSession) => set({ chatLockSession }),

  setChatLockInitialized: (chatLockInitialized) => set({ chatLockInitialized }),
}))
