'use client'
import { create } from 'zustand'
import type { ChatWithParticipants, Message, MessageWithSender } from '@/types/app'

interface ChatState {
  chats: ChatWithParticipants[]
  activeChatId: string | null
  messages: Record<string, MessageWithSender[]>
  typingUsers: Record<string, string[]>

  setChats: (chats: ChatWithParticipants[]) => void
  setActiveChat: (chatId: string | null) => void
  addChat: (chat: ChatWithParticipants) => void
  setMessages: (chatId: string, messages: MessageWithSender[]) => void
  prependMessages: (chatId: string, messages: MessageWithSender[]) => void
  addMessage: (chatId: string, message: MessageWithSender, isLocked?: boolean) => void
  updateMessage: (chatId: string, messageId: string, updates: Partial<MessageWithSender>) => void
  removeMessage: (chatId: string, messageId: string) => void
  setTypingUsers: (chatId: string, userIds: string[]) => void
  updateChatTheme: (chatId: string, theme: string | null) => void
  updateChatBackground: (chatId: string, url: string | null) => void
  updateLastMessage: (chatId: string, message: Message) => void
  removeChat: (chatId: string) => void
  hiddenChats: ChatWithParticipants[]
  setHiddenChats: (chats: ChatWithParticipants[]) => void
  activeHiddenChat: ChatWithParticipants | null
  setActiveHiddenChat: (chat: ChatWithParticipants | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  typingUsers: {},

  setChats: (chats) => set({ chats }),
  setActiveChat: (activeChatId) => set({ activeChatId }),
  addChat: (chat) =>
    set((s) => ({
      chats: s.chats.some((c) => c.id === chat.id)
        ? s.chats.map((c) => (c.id === chat.id ? chat : c))
        : [chat, ...s.chats],
    })),

  setMessages: (chatId, messages) =>
    set((s) => ({ messages: { ...s.messages, [chatId]: messages } })),

  prependMessages: (chatId, messages) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: [...messages, ...(s.messages[chatId] ?? [])],
      },
    })),

  addMessage: (chatId, message, isLocked = false) =>
    set((s) => {
      const existing = s.messages[chatId] ?? []
      if (existing.some((m) => m.id === message.id)) return s
      const newMessages = { ...s.messages, [chatId]: [...existing, message] }
      if (isLocked) {
        return { messages: newMessages }
      }
      return {
        messages: newMessages,
        chats: s.chats.map((c) =>
          c.id === chatId ? { ...c, lastMessage: message } : c
        ),
      }
    }),

  updateMessage: (chatId, messageId, updates) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] ?? []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      },
    })),

  removeMessage: (chatId, messageId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] ?? []).filter((m) => m.id !== messageId),
      },
    })),

  setTypingUsers: (chatId, userIds) =>
    set((s) => ({ typingUsers: { ...s.typingUsers, [chatId]: userIds } })),

  updateChatTheme: (chatId, theme) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, custom_theme: theme } : c)),
    })),

  updateChatBackground: (chatId, url) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, background_url: url } : c)),
    })),

  updateLastMessage: (chatId, message) =>
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === chatId ? { ...c, lastMessage: message } : c
      ),
    })),

  removeChat: (chatId) =>
    set((s) => ({
      chats: s.chats.filter((c) => c.id !== chatId),
      activeChatId: s.activeChatId === chatId ? null : s.activeChatId,
    })),

  hiddenChats: [],
  setHiddenChats: (hiddenChats) => set({ hiddenChats }),
  activeHiddenChat: null,
  setActiveHiddenChat: (activeHiddenChat) => set({ activeHiddenChat }),
}))
