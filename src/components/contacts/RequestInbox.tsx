'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useContactStore } from '@/stores/contactStore'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { acceptContactRequest, rejectContactRequest } from '@/services/contactRequestService'
import { getChats } from '@/services/chatService'
import type { ChatRequest } from '@/types/app'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function RequestCard({ request }: { request: ChatRequest }) {
  const router = useRouter()
  const { user } = useAuthStore()
  const { removeRequest } = useContactStore()
  const { showToast, setMobileChatOpen, setNewChatId } = useUIStore()
  const { setChats, setActiveChat } = useChatStore()
  const [busy, setBusy] = useState(false)

  async function handleAccept() {
    setBusy(true)
    try {
      const chatId = await acceptContactRequest(request.id)
      removeRequest(request.id)
      showToast('Connected!', 'success')
      if (user) {
        const updated = await getChats(user.id).catch(() => null)
        if (updated) {
          setChats(updated)
          setNewChatId(chatId)
          setTimeout(() => setNewChatId(null), 800)
        }
      }
      setActiveChat(chatId)
      setMobileChatOpen(true)
      router.push(`/chats/${chatId}`)
    } catch {
      showToast('Failed to accept request', 'error')
      setBusy(false)
    }
  }

  async function handleDecline() {
    setBusy(true)
    try {
      await rejectContactRequest(request.id)
      removeRequest(request.id)
    } catch {
      showToast('Failed to decline request', 'error')
      setBusy(false)
    }
  }

  return (
    <div className="request-card">
      <div className="request-card-header">
        <div className="request-dot" />
        <div className="request-card-body">
          <div className="request-card-title">Someone wants to connect</div>
          <div className="request-card-time">Received {timeAgo(request.created_at)}</div>
        </div>
      </div>
      <div className="request-card-actions">
        <button className="accept-btn" onClick={handleAccept} disabled={busy}>
          Accept
        </button>
        <button className="decline-btn" onClick={handleDecline} disabled={busy}>
          Decline
        </button>
      </div>
    </div>
  )
}

export function RequestInbox() {
  const { pendingRequests } = useContactStore()

  if (pendingRequests.length === 0) {
    return (
      <div className="contacts-empty">
        <div className="contacts-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div className="contacts-empty-text">
          No pending requests.
          <br />Share your code to let someone in.
        </div>
      </div>
    )
  }

  return (
    <div>
      {pendingRequests.map((req) => (
        <RequestCard key={req.id} request={req} />
      ))}
    </div>
  )
}
