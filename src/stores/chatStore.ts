'use client'
import { create } from 'zustand'
import type { ChatWithParticipants, MessageWithSender } from '@/types/app'

interface ChatState {
  chats: ChatWithParticipants[]
  activeChatId: string | null
  messages: Record<string, MessageWithSender[]>
  typingUsers: Record<string, string[]>

  setChats: (chats: ChatWithParticipants[]) => void
  setActiveChat: (chatId: string | null) => void
  setMessages: (chatId: string, messages: MessageWithSender[]) => void
  addMessage: (chatId: string, message: MessageWithSender) => void
  updateMessage: (chatId: string, messageId: string, updates: Partial<MessageWithSender>) => void
  removeMessage: (chatId: string, messageId: string) => void
  setTypingUsers: (chatId: string, userIds: string[]) => void
  updateChatTheme: (chatId: string, theme: string | null) => void
  updateLastMessage: (chatId: string, message: MessageWithSender) => void
  removeChat: (chatId: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  typingUsers: {},

  setChats: (chats) => set({ chats }),
  setActiveChat: (activeChatId) => set({ activeChatId }),

  setMessages: (chatId, messages) =>
    set((s) => ({ messages: { ...s.messages, [chatId]: messages } })),

  addMessage: (chatId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: [...(s.messages[chatId] ?? []), message],
      },
    })),

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
}))
