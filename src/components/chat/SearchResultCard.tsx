'use client'
import { memo } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { formatMessageTime, getSearchExcerpt, highlightMatch } from '@/lib/utils'
import type { MessageWithSender } from '@/types/app'

interface Props {
  message: MessageWithSender
  query: string
  onTap: (message: MessageWithSender) => void
  isJumping?: boolean
  disabled?: boolean
}

export const SearchResultCard = memo(function SearchResultCard({ message, query, onTap, isJumping, disabled }: Props) {
  const name = message.sender?.display_name ?? message.sender?.username ?? 'Unknown'
  const avatar = message.sender?.public_avatar ?? null
  const excerpt = getSearchExcerpt(message.content ?? '', query)
  const parts = highlightMatch(excerpt, query)

  return (
    <button
      type="button"
      className={`search-result-card${isJumping ? ' search-result-card--jumping' : ''}`}
      onClick={() => !disabled && onTap(message)}
      disabled={disabled}
      aria-label={`Message from ${name}: ${message.content ?? ''}`}
      aria-busy={isJumping}
    >
      {isJumping ? (
        <div className="search-result-jump-spinner" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
      ) : (
        <Avatar src={avatar} name={name} size={36} />
      )}
      <div className="search-result-body">
        <div className="search-result-header">
          <span className="search-result-name">{name}</span>
          <span className="search-result-time">{formatMessageTime(message.created_at)}</span>
        </div>
        <p className="search-result-snippet">
          {parts.map((part, i) =>
            part.highlight
              ? <mark key={i} className="search-result-mark">{part.text}</mark>
              : <span key={i}>{part.text}</span>
          )}
        </p>
      </div>
    </button>
  )
})
