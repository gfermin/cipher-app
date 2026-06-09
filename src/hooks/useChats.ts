'use client'
import { useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { getChats } from '@/services/chatService'
import type { Message } from '@/types/app'

export function useChats() {
  const { user } = useAuthStore()
  const { setChats, chats, updateLastMessage } = useChatStore()

  useEffect(() => {
    if (!user) return
    let mounted = true

    getChats(user.id).then((c) => {
      if (mounted) setChats(c)
    })

    return () => { mounted = false }
  }, [user, setChats])

  // Update the last-message preview for the affected chat on every new message INSERT.
  // Targeted store mutation avoids a full getChats() reload (which was O(N×5) DB queries).
  useEffect(() => {
    if (!user) return
    const supabase = getSupabaseClient()

    const channel = supabase
      .channel(`chat-list:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message
          const knownChat = useChatStore.getState().chats.some((c) => c.id === msg.chat_id)
          if (knownChat) updateLastMessage(msg.chat_id, msg)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, updateLastMessage])

  return { chats }
}
