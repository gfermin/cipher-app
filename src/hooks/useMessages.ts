'use client'
import { useEffect, useRef, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { getMessages, setTyping, clearTyping, vaultChatImages } from '@/services/messageService'
import { useUIStore } from '@/stores/uiStore'
import { TYPING_DEBOUNCE_MS } from '@/lib/constants'
import type { MessageWithSender } from '@/types/app'

export function useMessages(chatId: string | null) {
  const { user } = useAuthStore()
  const { messages, addMessage, updateMessage, setTypingUsers, setMessages, removeMessage } = useChatStore()
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chatMessages = chatId ? (messages[chatId] ?? []) : []

  useEffect(() => {
    if (!chatId) return
    let mounted = true

    getMessages(chatId).then((msgs) => {
      if (mounted) setMessages(chatId, msgs)
    })

    return () => { mounted = false }
  }, [chatId, setMessages])

  // Vault images on unmount
  useEffect(() => {
    if (!chatId) return
    return () => {
      vaultChatImages(chatId).then((count) => {
        if (count > 0) useUIStore.getState().showToast('Images vaulted', 'success')
      }).catch(() => {})
    }
  }, [chatId])

  // Realtime messages
  useEffect(() => {
    if (!chatId) return
    const supabase = getSupabaseClient()

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const { data: senderData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.new.sender_id)
            .single()
          // Always add the message — use a minimal fallback if the profile fetch fails
          const sender = senderData ?? {
            id: payload.new.sender_id,
            username: '',
            display_name: null,
            public_avatar: null,
            app_theme: 'dark',
            created_at: '',
            updated_at: '',
          }
          addMessage(chatId, { ...payload.new, sender } as unknown as MessageWithSender)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          updateMessage(chatId, payload.new.id, payload.new as Partial<MessageWithSender>)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          removeMessage(chatId, (payload.old as { id: string }).id)
        }
      )
      .subscribe((status) => {
        // On SUBSCRIBED, re-fetch to catch any messages sent during connection setup
        if (status === 'SUBSCRIBED') {
          getMessages(chatId).then((msgs) => setMessages(chatId, msgs)).catch(() => {})
        }
        // On error, fall back to polling once to ensure consistency
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          getMessages(chatId).then((msgs) => setMessages(chatId, msgs)).catch(() => {})
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [chatId, addMessage, updateMessage, setMessages, removeMessage])

  // Realtime typing
  useEffect(() => {
    if (!chatId || !user) return
    const supabase = getSupabaseClient()

    const channel = supabase
      .channel(`typing:${chatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'typing_indicators', filter: `chat_id=eq.${chatId}` },
        async () => {
          const { data } = await supabase
            .from('typing_indicators')
            .select('user_id')
            .eq('chat_id', chatId)
            .neq('user_id', user.id)
          setTypingUsers(chatId, (data ?? []).map((t) => (t as { user_id: string }).user_id))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [chatId, user, setTypingUsers])

  const handleTyping = useCallback(() => {
    if (!chatId || !user) return
    setTyping(chatId, user.id)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => clearTyping(chatId, user.id), TYPING_DEBOUNCE_MS)
  }, [chatId, user])

  return { messages: chatMessages, handleTyping }
}
