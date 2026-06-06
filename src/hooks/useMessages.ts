'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { getMessages, getMessagesBefore, getMessagesAfter, setTyping, clearTyping } from '@/services/messageService'
import { TYPING_DEBOUNCE_MS } from '@/lib/constants'
import type { MessageWithSender } from '@/types/app'

export function useMessages(chatId: string | null) {
  const { user } = useAuthStore()
  const { messages, addMessage, updateMessage, setTypingUsers, setMessages, prependMessages, removeMessage } = useChatStore()
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadingMoreRef = useRef(false)
  const subscribedOnceRef = useRef(false)
  const [hasMore, setHasMore] = useState(false)
  const chatMessages = chatId ? (messages[chatId] ?? []) : []

  useEffect(() => {
    if (!chatId) return
    let mounted = true
    setHasMore(false)
    subscribedOnceRef.current = false

    getMessages(chatId).then((msgs) => {
      if (!mounted) return
      setMessages(chatId, msgs)
      setHasMore(msgs.length === 40)
    })

    return () => { mounted = false }
  }, [chatId, setMessages])

  const loadMoreMessages = useCallback(async () => {
    if (!chatId || loadingMoreRef.current || !hasMore) return
    const oldest = useChatStore.getState().messages[chatId]?.[0]
    if (!oldest) return

    loadingMoreRef.current = true
    try {
      const older = await getMessagesBefore(chatId, oldest.created_at)
      prependMessages(chatId, older)
      setHasMore(older.length === 40)
    } finally {
      loadingMoreRef.current = false
    }
  }, [chatId, hasMore, prependMessages])

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
        if (status === 'SUBSCRIBED') {
          if (!subscribedOnceRef.current) {
            // First subscription: initial load already done; just mark as connected.
            subscribedOnceRef.current = true
          } else {
            // Reconnect: fetch only messages that arrived during the disconnection
            // window and merge them — preserves any pagination history the user loaded.
            const latest = useChatStore.getState().messages[chatId]?.at(-1)
            if (latest) {
              getMessagesAfter(chatId, latest.created_at)
                .then((newMsgs) => { newMsgs.forEach((m) => addMessage(chatId, m)) })
                .catch(() => {})
            } else {
              getMessages(chatId).then((msgs) => setMessages(chatId, msgs)).catch(() => {})
            }
          }
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Hard error: full refresh is safest.
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

  return { messages: chatMessages, handleTyping, loadMoreMessages, hasMore }
}
