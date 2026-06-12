'use client'
import { SearchResultCard } from './SearchResultCard'
import type { MessageWithSender } from '@/types/app'

interface Props {
  results: MessageWithSender[]
  query: string
  isLoading: boolean
  error: string | null
  onSelect: (message: MessageWithSender) => void
  onRetry: () => void
  jumpingMessageId?: string | null
}

export function SearchResultList({ results, query, isLoading, error, onSelect, onRetry, jumpingMessageId }: Props) {
  if (isLoading) {
    return (
      <div className="search-result-list" role="status" aria-label="Searching">
        {[0, 1, 2].map((i) => (
          <div key={i} className="search-skeleton-card">
            <div className="search-skeleton-avatar" />
            <div className="search-skeleton-body">
              <div className="search-skeleton-line search-skeleton-name" />
              <div className="search-skeleton-line search-skeleton-text" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="search-result-empty" role="alert">
        <p>{error}</p>
        <button type="button" className="search-retry-btn" onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }

  const trimmedQuery = query.trim()

  if (trimmedQuery.length < 2) {
    return (
      <div className="search-result-empty">
        <p>Search for messages in this chat.</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="search-result-empty">
        <p>No results for &ldquo;{trimmedQuery}&rdquo;</p>
      </div>
    )
  }

  return (
    <div
      className="search-result-list"
      role="list"
      aria-label={`${results.length} search result${results.length === 1 ? '' : 's'}`}
    >
      <div className="search-result-count">Results ({results.length})</div>
      {results.map((msg) => (
        <div key={msg.id} role="listitem">
          <SearchResultCard
            message={msg}
            query={trimmedQuery}
            onTap={onSelect}
            isJumping={jumpingMessageId === msg.id}
            disabled={jumpingMessageId !== null}
          />
        </div>
      ))}
    </div>
  )
}
