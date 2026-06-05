'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useContactStore } from '@/stores/contactStore'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import {
  getReceivedRequests,
  subscribeToIncomingRequests,
  subscribeToAcceptedRequests,
} from '@/services/contactRequestService'
import { getChats } from '@/services/chatService'

// Call once in AppLayout so subscriptions are always active while logged in.
export function useContactRequests() {
  const { user } = useAuthStore()
  const { setPendingRequests, addPendingRequest, removeRequest } = useContactStore()
  const { showToast } = useUIStore()
  const { setChats } = useChatStore()

  // Fetch received pending requests on mount
  useEffect(() => {
    if (!user) return
    getReceivedRequests().then(setPendingRequests).catch(() => {})
  }, [user, setPendingRequests])

  // Realtime: new request arrives for this user
  useEffect(() => {
    if (!user) return
    return subscribeToIncomingRequests(user.id, (request) => {
      addPendingRequest(request)
      showToast('Someone wants to connect with you', 'info')
    })
  }, [user, addPendingRequest, showToast])

  // Realtime: a request this user sent was accepted → reload chats
  useEffect(() => {
    if (!user) return
    return subscribeToAcceptedRequests(user.id, async (request) => {
      removeRequest(request.id)
      showToast('Your contact request was accepted!', 'success')
      const updated = await getChats(user.id).catch(() => null)
      if (updated) setChats(updated)
    })
  }, [user, removeRequest, showToast, setChats])
}
