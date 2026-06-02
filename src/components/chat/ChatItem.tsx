'use client'
import { Avatar } from '@/components/ui/Avatar'
import { formatMessageTime } from '@/lib/utils'
import type { ChatWithParticipants } from '@/types/app'

interface Props {
  chat: ChatWithParticipants
  isActive: boolean
  currentUserId: string
  onClick: () => void
}

export function ChatItem({ chat, isActive, currentUserId, onClick }: Props) {
  const { otherUser, lastMessage, unreadCount } = chat

  function renderPreview(): string {
    if (!lastMessage) return 'Start a conversation'
    if (lastMessage.type === 'deleted') return 'Message deleted'
    if (lastMessage.type === 'image') {
      return lastMessage.is_vaulted ? 'Sent a photo 🔒' : 'Sent a photo 📷'
    }
    const prefix = lastMessage.sender_id === currentUserId ? 'You: ' : ''
    return prefix + (lastMessage.content ?? '')
  }

  const privateAvatar = chat.myPreferences?.private_avatar

  return (
    <div className={`chat-item ${isActive ? 'active' : ''}`} onClick={onClick}>
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
          <span className="chat-item-last">{renderPreview()}</span>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  )
}
