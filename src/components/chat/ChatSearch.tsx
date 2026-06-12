'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { searchMessages, getMessagesAroundTimestamp } from '@/services/messageService'
import { SearchResultList } from './SearchResultList'
import type { MessageWithSender } from '@/types/app'

interface Props {
  chatId: string
  onJump: (messages: MessageWithSender[], targetMessageId: string) => void
  closing?: boolean
}

export function ChatSearch({ chatId, onJump, closing }: Props) {
  const {
    chatSearch,
    setSearchResults,
    setSearchLoading,
    closeSearch,
  } = useUIStore()
  const [error, setError] = useState<string | null>(null)
  const [jumpingMessageId, setJumpingMessageId] = useState<string | null>(null)
  // Version counter prevents stale async results from overwriting newer ones
  const queryVersionRef = useRef(0)

  useEffect(() => {
    const q = chatSearch.query.trim()
    if (q.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      setError(null)
      return
    }

    const version = ++queryVersionRef.current
    setSearchLoading(true)
    setError(null)

    searchMessages(chatId, q)
      .then((results) => {
        if (version !== queryVersionRef.current) return
        setSearchResults(results)
      })
      .catch(() => {
        if (version !== queryVersionRef.current) return
        setError('Unable to search right now.')
        setSearchResults([])
      })
      .finally(() => {
        if (version === queryVersionRef.current) setSearchLoading(false)
      })
  // reconnectTrigger increment re-fires this effect after a hard channel error,
  // re-running the current query against the refreshed message set.
  }, [chatSearch.query, chatSearch.reconnectTrigger, chatId, setSearchResults, setSearchLoading])

  const handleSelect = useCallback(
    async (message: MessageWithSender) => {
      if (jumpingMessageId) return
      setJumpingMessageId(message.id)
      try {
        const window = await getMessagesAroundTimestamp(chatId, message.created_at, 30)
        onJump(window, message.id)
      } catch {
        setJumpingMessageId(null)
      }
    },
    [chatId, jumpingMessageId, onJump]
  )

  const handleRetry = useCallback(() => {
    const q = chatSearch.query.trim()
    if (q.length < 2) return
    const version = ++queryVersionRef.current
    setSearchLoading(true)
    setError(null)
    searchMessages(chatId, q)
      .then((results) => {
        if (version !== queryVersionRef.current) return
        setSearchResults(results)
      })
      .catch(() => {
        if (version !== queryVersionRef.current) return
        setError('Unable to search right now.')
        setSearchResults([])
      })
      .finally(() => {
        if (version === queryVersionRef.current) setSearchLoading(false)
      })
  }, [chatId, chatSearch.query, setSearchResults, setSearchLoading])

  return (
    <div className={`chat-search-overlay${closing ? ' search-closing' : ''}`} role="region" aria-label="Message search results">
      <SearchResultList
        results={chatSearch.results}
        query={chatSearch.query}
        isLoading={chatSearch.isLoading}
        error={error}
        onSelect={handleSelect}
        onRetry={handleRetry}
        jumpingMessageId={jumpingMessageId}
      />
    </div>
  )
}
