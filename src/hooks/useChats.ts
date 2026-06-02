'use client'
import { useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { getChats } from '@/services/chatService'

export function useChats() {
  const { user } = useAuthStore()
  const { setChats, chats } = useChatStore()

  useEffect(() => {
    if (!user) return
    let mounted = true

    getChats(user.id).then((c) => {
      if (mounted) setChats(c)
    })

    return () => { mounted = false }
  }, [user, setChats])

  // Re-fetch chat list when any message is inserted in a chat the user participates in
  useEffect(() => {
    if (!user) return
    const supabase = getSupabaseClient()

    const channel = supabase
      .channel(`chat-list:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          getChats(user.id).then(setChats).catch(() => {})
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, setChats])

  return { chats }
}
