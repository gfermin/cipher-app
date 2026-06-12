'use client'
import { create } from 'zustand'
import type { Toast, VaultState, MessageWithSender } from '@/types/app'
import { generateId } from '@/lib/utils'

interface ChatSearchState {
  isOpen: boolean
  query: string
  results: MessageWithSender[]
  isLoading: boolean
  highlightedMessageId: string | null
  priorScrollPosition: number | null
  reconnectTrigger: number
}

const SEARCH_CLOSED: ChatSearchState = {
  isOpen: false,
  query: '',
  results: [],
  isLoading: false,
  highlightedMessageId: null,
  priorScrollPosition: null,
  reconnectTrigger: 0,
}

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
  chatSearch: ChatSearchState

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

  openSearch: () => void
  closeSearch: () => void
  setSearchQuery: (query: string) => void
  setSearchResults: (results: MessageWithSender[]) => void
  setSearchLoading: (isLoading: boolean) => void
  setHighlightedMessageId: (id: string | null) => void
  setPriorScrollPosition: (pos: number | null) => void
  triggerSearchReconnect: () => void
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
  chatSearch: { ...SEARCH_CLOSED },

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

  openSearch: () =>
    set({ chatSearch: { ...SEARCH_CLOSED, isOpen: true } }),

  closeSearch: () =>
    set({ chatSearch: { ...SEARCH_CLOSED } }),

  setSearchQuery: (query) =>
    set((s) => ({ chatSearch: { ...s.chatSearch, query } })),

  setSearchResults: (results) =>
    set((s) => ({ chatSearch: { ...s.chatSearch, results } })),

  setSearchLoading: (isLoading) =>
    set((s) => ({ chatSearch: { ...s.chatSearch, isLoading } })),

  setHighlightedMessageId: (highlightedMessageId) =>
    set((s) => ({ chatSearch: { ...s.chatSearch, highlightedMessageId } })),

  setPriorScrollPosition: (priorScrollPosition) =>
    set((s) => ({ chatSearch: { ...s.chatSearch, priorScrollPosition } })),

  triggerSearchReconnect: () =>
    set((s) => ({
      chatSearch: {
        ...s.chatSearch,
        reconnectTrigger: s.chatSearch.reconnectTrigger + 1,
        results: [],
        isLoading: true,
      },
    })),
}))
