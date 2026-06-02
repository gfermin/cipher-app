'use client'
import { Avatar } from '@/components/ui/Avatar'
import { useUIStore } from '@/stores/uiStore'
import type { ChatWithParticipants } from '@/types/app'

interface Props {
  chat: ChatWithParticipants
  onBack?: () => void
}

export function ChatHeader({ chat, onBack }: Props) {
  const { setChatSettings } = useUIStore()
  const { otherUser, myPreferences } = chat
  const displayAvatar = myPreferences?.private_avatar ?? otherUser.public_avatar
  const name = otherUser.display_name ?? otherUser.username

  return (
    <div className="chat-header" onClick={() => setChatSettings(true)}>
      {onBack && (
        <button
          className="mobile-back-btn"
          onClick={(e) => { e.stopPropagation(); onBack() }}
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
      )}

      <Avatar src={displayAvatar} name={name} size={40} />

      <div className="chat-header-info">
        <div className="chat-header-name">{name}</div>
        <div className="chat-header-status">Tap for info</div>
      </div>

      <button
        className="header-btn"
        onClick={(e) => { e.stopPropagation(); setChatSettings(true) }}
        aria-label="More options"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>
    </div>
  )
}
