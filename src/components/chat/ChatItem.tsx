'use client'
import { useChatStore } from '@/stores/chatStore'
import { Avatar } from '@/components/ui/Avatar'
import { formatMessageTime } from '@/lib/utils'
import type { ChatWithParticipants } from '@/types/app'

interface Props {
  chat: ChatWithParticipants
  isActive: boolean
  currentUserId: string
  isNew?: boolean
  isLocked?: boolean
  onClick: () => void
  onUnlockRequest?: () => void
}

export function ChatItem({ chat, isActive, currentUserId, isNew, isLocked, onClick, onUnlockRequest }: Props) {
  const { typingUsers } = useChatStore()
  const { otherUser, lastMessage, unreadCount } = chat
  const isTyping = !isLocked && (typingUsers[chat.id]?.length ?? 0) > 0

  function renderPreview(): string {
    if (!lastMessage) return 'Start a conversation'
    if (lastMessage.type === 'deleted') return 'Message deleted'
    if (lastMessage.type === 'image') {
      return lastMessage.is_vaulted ? 'Sent a photo 🔒' : 'Sent a photo 📷'
    }
    const prefix = lastMessage.sender_id === currentUserId ? 'You: ' : ''
    return prefix + (lastMessage.content ?? '')
  }

  function handleClick() {
    if (isLocked) onUnlockRequest?.()
    else onClick()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() }
  }

  const privateAvatar = chat.myPreferences?.private_avatar

  return (
    <div
      className={`chat-item${isActive ? ' active' : ''}${isNew ? ' chat-item-new' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      data-locked={isLocked ? '' : undefined}
      aria-label={isLocked ? `${otherUser.display_name ?? otherUser.username} — Locked` : undefined}
    >
      <Avatar
        src={privateAvatar ?? otherUser.public_avatar}
        name={otherUser.display_name ?? otherUser.username}
        size={44}
        online={false}
      />
      <div className="chat-item-info">
        <div className="chat-item-top">
          <span className="chat-item-name">
            {otherUser.display_name ?? otherUser.username}
          </span>
          <span className="chat-item-time">
            {lastMessage ? formatMessageTime(lastMessage.created_at) : ''}
          </span>
        </div>
        <div className="chat-item-preview">
          {isLocked ? (
            <span className="chat-item-lock-hint">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Locked
            </span>
          ) : (
            <>
              <span className="chat-item-last">
                {isTyping ? 'typing...' : renderPreview()}
              </span>
              {!isTyping && unreadCount > 0 && (
                <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
