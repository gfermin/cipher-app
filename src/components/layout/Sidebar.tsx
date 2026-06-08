'use client'
import { useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { ChatList } from '@/components/chat/ChatList'
import { HiddenChatBoard } from '@/components/chat/HiddenChatBoard'
import { Avatar } from '@/components/ui/Avatar'

interface Props {
  hidden?: boolean
  pendingCount: number
  onSettingsClick?: () => void
  onContactsClick?: () => void
}

export function Sidebar({ hidden, pendingCount, onSettingsClick, onContactsClick }: Props) {
  const { user } = useAuthStore()
  const { openHiddenBoard } = useUIStore()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function startLongPress() {
    longPressTimer.current = setTimeout(() => { openHiddenBoard() }, 600)
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  return (
    <div className={`sidebar ${hidden ? 'hidden' : ''}`}>
      <div className="sidebar-header">
        <div
          className="sidebar-title"
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onContextMenu={(e) => e.preventDefault()}
          style={{ userSelect: 'none' }}
        >Cipher</div>

        {user && (
          <Avatar
            src={user.profile.public_avatar}
            name={user.profile.display_name ?? user.profile.username}
            size={32}
          />
        )}

        {/* Contacts icon with badge */}
        <button
          className="sidebar-icon-btn"
          onClick={onContactsClick}
          aria-label="Contacts"
          title="Contacts"
          style={{ position: 'relative' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {pendingCount > 0 && (
            <span className="nav-badge" style={{ top: -3, right: -3 }}>
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>

        <button
          className="sidebar-icon-btn"
          onClick={onSettingsClick}
          aria-label="Settings"
          title="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      <ChatList />
      <HiddenChatBoard />
    </div>
  )
}
