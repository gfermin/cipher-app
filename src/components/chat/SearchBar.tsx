'use client'
import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '@/stores/uiStore'

export function SearchBar() {
  const { chatSearch, setSearchQuery, closeSearch } = useUIStore()
  const [localQuery, setLocalQuery] = useState(chatSearch.query)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus with RAF so iOS mounts the element before we focus
  useEffect(() => {
    const raf = requestAnimationFrame(() => { inputRef.current?.focus() })
    return () => cancelAnimationFrame(raf)
  }, [])

  // Sync when external code resets query (e.g., chatId change clears the store)
  useEffect(() => {
    if (chatSearch.query === '') setLocalQuery('')
  }, [chatSearch.query])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setLocalQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearchQuery(value), 300)
  }

  function handleClear() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLocalQuery('')
    setSearchQuery('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') closeSearch()
  }

  return (
    <div className="header-search-bar">
      <input
        ref={inputRef}
        type="search"
        className="header-search-input"
        placeholder="Search messages..."
        value={localQuery}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-label="Search messages"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {localQuery.length > 0 && (
        <button
          type="button"
          className="header-search-clear-btn"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      )}
    </div>
  )
}
