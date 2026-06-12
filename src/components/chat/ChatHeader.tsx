'use client'
import { useEffect } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { useUIStore } from '@/stores/uiStore'
import { SearchBar } from './SearchBar'
import type { ChatWithParticipants } from '@/types/app'

interface Props {
  chat: ChatWithParticipants
  onBack?: () => void
}

export function ChatHeader({ chat, onBack }: Props) {
  const { setChatSettings, openSearch, closeSearch, chatSearch, lockedChats } = useUIStore()
  const { otherUser, myPreferences } = chat
  const displayAvatar = myPreferences?.private_avatar ?? otherUser.public_avatar
  const name = otherUser.display_name ?? otherUser.username
  const isSearchOpen = chatSearch.isOpen
  const isLocked = lockedChats.has(chat.id)

  // Android back button closes search
  useEffect(() => {
    if (!isSearchOpen) return
    window.history.pushState(null, '')
    function onPopState() { closeSearch() }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [isSearchOpen, closeSearch])

  return (
    <div
      className={`chat-header${isSearchOpen ? ' search-open' : ''}`}
      onClick={() => { if (!isSearchOpen) setChatSettings(true) }}
    >
      {/* Normal header content */}
      <div className="chat-header-normal">
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

        {!isLocked && (
          <button
            className="header-btn"
            onClick={(e) => { e.stopPropagation(); openSearch() }}
            aria-label="Search messages"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
        )}

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

      {/* Search mode content — absolutely overlays normal content */}
      <div
        className="chat-header-search-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="header-btn"
          onClick={closeSearch}
          aria-label="Close search"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        {isSearchOpen && <SearchBar />}
      </div>
    </div>
  )
}
