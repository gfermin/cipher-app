'use client'
import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useMessages } from '@/hooks/useMessages'
import { useVault, useAutoVault } from '@/hooks/useVault'
import { deleteMessage, getMessages } from '@/services/messageService'
import { markMessagesRead } from '@/services/chatService'
import { optimizeImageUrl } from '@/services/storageService'
import { ChatHeader } from './ChatHeader'
import { ChatSearch } from './ChatSearch'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { VaultTransitionOverlay } from '@/components/vault/VaultTransitionOverlay'
import { VaultGallery } from '@/components/vault/VaultGallery'
import { VaultSetupModal } from '@/components/vault/VaultSetupModal'
import { ImageViewer } from './ImageViewer'
import { DeleteModal } from '@/components/ui/DeleteModal'
import type { MessageWithSender } from '@/types/app'

interface Props {
  chatId: string
  onBack?: () => void
}

export function ChatPanel({ chatId, onBack }: Props) {
  const { user } = useAuthStore()
  const { chats, typingUsers, updateMessage, setMessages, activeHiddenChat } = useChatStore()
  const { setMobileChatOpen, chatLockEnabled, lockChat, isMobileChatOpen } = useUIStore()
  const setPendingVaultSetupChatId = useUIStore((s) => s.setPendingVaultSetupChatId)
  const closeSearch = useUIStore((s) => s.closeSearch)
  const chatSearch = useUIStore((s) => s.chatSearch)
  const isCurrentChatLocked = useUIStore((s) => s.lockedChats.has(chatId))
  const setPriorScrollPosition = useUIStore((s) => s.setPriorScrollPosition)
  const setHighlightedMessageId = useUIStore((s) => s.setHighlightedMessageId)
  const { messages, handleTyping, loadMoreMessages, hasMore, setHasMore } = useMessages(chatId)
  const { isUnlocked, tryUnlockWithInput, lockVault } = useVault()
  useAutoVault(chatId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef(0)
  // Set to true just before replacing messages via a search jump so the
  // scroll-to-bottom effect doesn't compete with the scroll-to-highlighted effect.
  const isJumpingRef = useRef(false)
  const [showVaultTransition, setShowVaultTransition] = useState(false)
  const [showVault, setShowVault] = useState(false)
  const [showVaultSetup, setShowVaultSetup] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewingJumpedWindow, setViewingJumpedWindow] = useState(false)
  const [searchMounted, setSearchMounted] = useState(false)
  const [searchClosing, setSearchClosing] = useState(false)
  const searchCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tracks whether search was open on the previous effect run, without adding searchMounted to deps
  const prevSearchOpenRef = useRef(false)

  // Close search when switching chats or unmounting
  useEffect(() => {
    return () => { closeSearch() }
  }, [chatId, closeSearch])

  // Close search when app goes to background
  useEffect(() => {
    function handleVisibility() { if (document.hidden) closeSearch() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [closeSearch])

  // Close search if the chat becomes locked mid-session (e.g., lock-all from HiddenChatBoard)
  useEffect(() => {
    if (isCurrentChatLocked) closeSearch()
  }, [isCurrentChatLocked, closeSearch])

  // Manage search overlay mount/unmount with a 180ms fade-out before removal
  useEffect(() => {
    if (chatSearch.isOpen) {
      if (searchCloseTimerRef.current) {
        clearTimeout(searchCloseTimerRef.current)
        searchCloseTimerRef.current = null
      }
      setSearchClosing(false)
      setSearchMounted(true)
      prevSearchOpenRef.current = true
    } else if (prevSearchOpenRef.current) {
      prevSearchOpenRef.current = false
      setSearchClosing(true)
      searchCloseTimerRef.current = setTimeout(() => {
        setSearchMounted(false)
        setSearchClosing(false)
        searchCloseTimerRef.current = null
      }, 180)
    }
    return () => {
      if (searchCloseTimerRef.current) clearTimeout(searchCloseTimerRef.current)
    }
  }, [chatSearch.isOpen])

  // Reset jumped window state when chatId changes
  useEffect(() => {
    setViewingJumpedWindow(false)
  }, [chatId])

  // Save scroll position when search opens; restore it when search closes
  const searchScrollRef = useRef<number | null>(null)
  useEffect(() => {
    if (chatSearch.isOpen) {
      const pos = messagesAreaRef.current?.scrollTop ?? 0
      searchScrollRef.current = pos
      setPriorScrollPosition(pos)
    } else if (searchScrollRef.current !== null) {
      const pos = searchScrollRef.current
      searchScrollRef.current = null
      requestAnimationFrame(() => {
        if (messagesAreaRef.current) messagesAreaRef.current.scrollTop = pos
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSearch.isOpen])

  // Scroll to the highlighted message after a jump, then clear the highlight after 2.5s.
  // Uses 'instant' — smooth scroll on a full DOM window swap is jarring on iOS.
  // The 1.5s highlight animation provides the visual "find me" cue instead.
  useEffect(() => {
    const id = chatSearch.highlightedMessageId
    if (!id) return
    requestAnimationFrame(() => {
      document.getElementById(`message-${id}`)?.scrollIntoView({ behavior: 'instant', block: 'center' })
    })
    const timer = setTimeout(() => setHighlightedMessageId(null), 2500)
    return () => clearTimeout(timer)
  }, [chatSearch.highlightedMessageId, setHighlightedMessageId])

  // Open VaultSetupModal automatically when navigated from the "no code set" unlock path
  useEffect(() => {
    const pending = useUIStore.getState().pendingVaultSetupChatId
    if (pending === chatId) {
      setPendingVaultSetupChatId(null)
      setShowVaultSetup(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  // Ref so the cleanup closure always reads the latest lock state
  const chatLockEnabledRef = useRef(chatLockEnabled)
  useEffect(() => { chatLockEnabledRef.current = chatLockEnabled }, [chatLockEnabled])

  // Pending deferred lock — used to cancel a StrictMode fake-unmount re-lock.
  // Shape: { timer, chatId } so we only cancel if the same chat is remounting.
  const pendingLockRef = useRef<{ timer: ReturnType<typeof setTimeout>; chatId: string } | null>(null)

  // Lock the chat when the user navigates away (chatId changes or component unmounts).
  // Deferred by one tick so React 18 StrictMode's fake unmount→remount cycle can
  // cancel the lock before it fires (real unmounts have no subsequent remount to cancel).
  useEffect(() => {
    if (pendingLockRef.current?.chatId === chatId) {
      clearTimeout(pendingLockRef.current.timer)
      pendingLockRef.current = null
    }
    return () => {
      if (!chatLockEnabledRef.current) return
      const id = chatId
      const timer = setTimeout(() => {
        pendingLockRef.current = null
        lockChat(id)
      }, 0)
      pendingLockRef.current = { timer, chatId: id }
    }
  }, [chatId, lockChat])

  const chat = chats.find((c) => c.id === chatId)
    ?? (activeHiddenChat?.id === chatId ? activeHiddenChat : null)
  const typingList = typingUsers[chatId] ?? []

  // Scroll to bottom on new messages (skip when prepending old messages or jumping to a search result)
  useEffect(() => {
    if (prevScrollHeightRef.current > 0) return
    if (isJumpingRef.current) {
      isJumpingRef.current = false
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Restore scroll position after older messages are prepended
  useLayoutEffect(() => {
    const area = messagesAreaRef.current
    if (!area || prevScrollHeightRef.current === 0) return
    const diff = area.scrollHeight - prevScrollHeightRef.current
    if (diff > 0) area.scrollTop += diff
    prevScrollHeightRef.current = 0
  }, [messages.length])

  // Mark messages as read
  useEffect(() => {
    if (!user || !chatId) return
    markMessagesRead(chatId, user.id).catch(() => {})
  }, [chatId, user, messages.length])

  const handleScroll = useCallback(() => {
    const area = messagesAreaRef.current
    if (!area || !hasMore) return
    if (area.scrollTop < 80) {
      prevScrollHeightRef.current = area.scrollHeight
      loadMoreMessages()
    }
  }, [hasMore, loadMoreMessages])

  // Jump to a message from search: replace current window, highlight target, show "Go to Latest"
  const handleJump = useCallback(
    (jumpedMessages: MessageWithSender[], targetMessageId: string) => {
      // Clear scroll restore — user is jumping to a new position, not dismissing search
      searchScrollRef.current = null
      // Suppress scroll-to-bottom: the highlighted-message effect will handle positioning
      isJumpingRef.current = true
      setMessages(chatId, jumpedMessages)
      // Assume there are messages before the window start; loadMoreMessages will correct if not
      setHasMore(true)
      setViewingJumpedWindow(true)
      // closeSearch() resets the entire chatSearch slice (including highlightedMessageId → null).
      // setHighlightedMessageId() must come LAST: Zustand applies set() calls sequentially,
      // so the final store state after batching retains the highlighted ID.
      closeSearch()
      setHighlightedMessageId(targetMessageId)
    },
    [chatId, closeSearch, setHighlightedMessageId, setHasMore, setMessages]
  )

  // Return to the latest 40 messages and scroll to bottom
  const handleGoToLatest = useCallback(async () => {
    const latest = await getMessages(chatId)
    setMessages(chatId, latest)
    setHasMore(latest.length === 40)
    setViewingJumpedWindow(false)
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [chatId, setHasMore, setMessages])

  const handleVaultTrigger = useCallback(
    async (password: string): Promise<boolean> => {
      const unlocked = await tryUnlockWithInput(password, chatId)
      if (unlocked) {
        setShowVaultTransition(true)
      }
      return unlocked
    },
    [tryUnlockWithInput, chatId]
  )

  function handleVaultTransitionComplete() {
    setShowVaultTransition(false)
    setShowVault(true)
  }

  function handleCloseVault() {
    setShowVault(false)
    lockVault()
  }

  async function handleDeleteMessage(messageId: string) {
    setDeleteTarget(messageId)
  }

  async function confirmDeleteMessage() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteMessage(deleteTarget)
      updateMessage(chatId, deleteTarget, { type: 'deleted', content: null })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const chatTheme = chat?.custom_theme
  const background = chat?.background_url ?? user?.profile.global_background_url ?? null

  if (!chat) {
    return (
      <div className={`chat-panel${isMobileChatOpen ? ' visible' : ''}`} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Chat not found</div>
      </div>
    )
  }

  return (
    <div
      className={`chat-panel${isMobileChatOpen ? ' visible' : ''}${chatTheme ? ` chat-theme-${chatTheme}` : ''}`}
      style={background ? { background: 'transparent' } : undefined}
    >
      {background && (
        <div className="chat-bg-wrap" aria-hidden="true">
          <img
            className="chat-bg-layer"
            src={optimizeImageUrl(background)}
            alt=""
            decoding="async"
          />
          <div className="chat-scrim" />
        </div>
      )}

      <div className={`chat-body${searchMounted ? ' search-active' : ''}`}>
        <ChatHeader
          chat={chat}
          onBack={() => { setMobileChatOpen(false); onBack?.() }}
        />

        <div className={`chat-messages-region${searchMounted ? ' search-active' : ''}`}>
          <div
            className="messages-area"
            ref={messagesAreaRef}
            onScroll={handleScroll}
            role="list"
            aria-label="Messages"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.sender_id === user?.id}
                vaultUnlocked={isUnlocked}
                onDelete={handleDeleteMessage}
              />
            ))}

            {typingList.length > 0 && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {viewingJumpedWindow && !chatSearch.isOpen && (
            <button
              type="button"
              className="go-to-latest-btn"
              onClick={handleGoToLatest}
              aria-label="Go to latest messages"
            >
              ↓ Latest messages
            </button>
          )}

          {searchMounted && (
            <>
              <div className={`chat-search-dim${searchClosing ? ' search-closing' : ''}`} aria-hidden="true" />
              <ChatSearch chatId={chatId} onJump={handleJump} closing={searchClosing} />
            </>
          )}
        </div>

        <MessageInput
          chatId={chatId}
          onTyping={handleTyping}
          onVaultTrigger={handleVaultTrigger}
          onVaultSetupTrigger={() => setShowVaultSetup(true)}
        />
      </div>

      {showVaultTransition && (
        <VaultTransitionOverlay onComplete={handleVaultTransitionComplete} />
      )}

      {showVault && (
        <VaultGallery chatId={chatId} onClose={handleCloseVault} />
      )}

      <ImageViewer />

      {showVaultSetup && (
        <VaultSetupModal chatId={chatId} onClose={() => setShowVaultSetup(false)} />
      )}

      {deleteTarget && (
        <DeleteModal
          title="Delete message?"
          description="This message will be deleted for everyone in this conversation."
          onConfirm={confirmDeleteMessage}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  )
}
