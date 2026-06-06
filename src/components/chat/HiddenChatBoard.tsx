'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChatStore } from '@/stores/chatStore'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { getHiddenChats } from '@/services/chatService'
import { ChatItem } from './ChatItem'
import { ChatUnlockModal } from './ChatUnlockModal'

const PULL_THRESHOLD = 64

export function HiddenChatBoard() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { hiddenChats, setHiddenChats, setActiveHiddenChat, setActiveChat } = useChatStore()
  const {
    hiddenBoardOpen, closeHiddenBoard,
    lockedChats, chatLockEnabled, lockChat,
    setMobileChatOpen,
  } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [unlockModalChatId, setUnlockModalChatId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(-1)
  const boardHistoryRef = useRef(false)
  // Prevents a double history.pushState in React 18 Strict Mode (which runs effects twice)
  const historyPushedRef = useRef(false)

  useEffect(() => {
    if (!hiddenBoardOpen || !user) return
    let mounted = true
    setLoading(true)
    getHiddenChats(user.id)
      .then((chats) => {
        if (!mounted) return
        setHiddenChats(chats)
        if (chatLockEnabled) chats.forEach((c) => lockChat(c.id))
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [hiddenBoardOpen, user, setHiddenChats, chatLockEnabled, lockChat])

  // Push a history entry when the board opens so Android hardware back closes it.
  // historyPushedRef guards against the double-push that React 18 Strict Mode causes
  // (Strict Mode runs the effect twice: cleanup removes the listener but the flag
  // prevents a second pushState on the re-run).
  useEffect(() => {
    if (!hiddenBoardOpen) {
      historyPushedRef.current = false
      return
    }

    if (!historyPushedRef.current) {
      history.pushState({ cipherHiddenBoard: true }, '')
      boardHistoryRef.current = true
      historyPushedRef.current = true
    }

    function onPopState() {
      if (!boardHistoryRef.current) return
      boardHistoryRef.current = false
      setHiddenChats([])
      closeHiddenBoard()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [hiddenBoardOpen, setHiddenChats, closeHiddenBoard])

  // Escape key
  useEffect(() => {
    if (!hiddenBoardOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleManualClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenBoardOpen])

  // Close without consuming the history entry — safe to call before router.push
  function doClose() {
    boardHistoryRef.current = false
    setHiddenChats([])
    closeHiddenBoard()
  }

  // Close and consume the history entry — for manual back/escape gestures only
  function handleManualClose() {
    if (boardHistoryRef.current) {
      boardHistoryRef.current = false
      history.back()
      setHiddenChats([])
      closeHiddenBoard()
    } else {
      doClose()
    }
  }

  function navigateToChat(chatId: string) {
    // Set store state synchronously so AppLayout renders ChatPanel immediately
    // without waiting for the route's initialChatId effect
    setActiveChat(chatId)
    setMobileChatOpen(true)
    router.push(`/chats/${chatId}`)
  }

  function handleUnlockModalClose() {
    const chatId = unlockModalChatId
    setUnlockModalChatId(null)
    if (chatId && !useUIStore.getState().lockedChats.has(chatId)) {
      // Chat was unlocked — preserve data for ChatPanel, then close board
      const chat = hiddenChats.find((c) => c.id === chatId)
      if (chat) {
        setActiveHiddenChat(chat)
        // Ensure AppLayout renders ChatPanel immediately (modal already called router.push)
        setActiveChat(chatId)
        setMobileChatOpen(true)
      }
      // Use doClose (not history.back) to avoid conflicting with ChatUnlockModal's router.push
      doClose()
    }
  }

  // Pull-to-refresh touch handlers
  function handleTouchStart(e: React.TouchEvent) {
    const el = listRef.current
    if (el && el.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY
    } else {
      touchStartY.current = -1
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current < 0 || refreshing || !user) return
    const delta = e.changedTouches[0].clientY - touchStartY.current
    touchStartY.current = -1
    if (delta >= PULL_THRESHOLD) doRefresh()
  }

  function doRefresh() {
    if (refreshing || !user) return
    setRefreshing(true)
    getHiddenChats(user.id)
      .then((chats) => {
        setHiddenChats(chats)
        if (chatLockEnabled) chats.forEach((c) => lockChat(c.id))
      })
      .finally(() => setRefreshing(false))
  }

  if (!hiddenBoardOpen) return null

  return (
    <div className="hidden-board">
      <div className="hidden-board-header">
        <button
          className="sidebar-icon-btn"
          onClick={handleManualClose}
          aria-label="Back to chats"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span className="hidden-board-title">Hidden</span>
      </div>

      <div
        ref={listRef}
        className="hidden-board-list"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {refreshing && (
          <div className="hidden-board-refresh">
            <div className="sheet-spinner" />
          </div>
        )}

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', alignItems: 'center' }}>
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 13, width: '60%', marginBottom: 'var(--sp-1)' }} />
                <div className="skeleton" style={{ height: 11, width: '80%' }} />
              </div>
            </div>
          ))
        ) : hiddenChats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-12) var(--sp-4)', color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>
            No hidden conversations
          </div>
        ) : (
          hiddenChats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={false}
              currentUserId={user?.id ?? ''}
              isLocked={lockedChats.has(chat.id)}
              onClick={() => {
                // Store chat data BEFORE doClose clears hiddenChats.
                // activeHiddenChat is NOT cleared in ChatPanel's cleanup (Strict Mode safe)
                // and IS cleared by AppLayout when the user returns to the chat list.
                setActiveHiddenChat(chat)
                // doClose avoids history.back() which would conflict with router.push
                doClose()
                navigateToChat(chat.id)
              }}
              onUnlockRequest={() => setUnlockModalChatId(chat.id)}
            />
          ))
        )}
      </div>

      {unlockModalChatId && (
        <ChatUnlockModal
          chatId={unlockModalChatId}
          onClose={handleUnlockModalClose}
        />
      )}
    </div>
  )
}
