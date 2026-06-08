'use client'
import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useMessages } from '@/hooks/useMessages'
import { useVault, useAutoVault } from '@/hooks/useVault'
import { deleteMessage } from '@/services/messageService'
import { markMessagesRead } from '@/services/chatService'
import { optimizeImageUrl } from '@/services/storageService'
import { ChatHeader } from './ChatHeader'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { VaultTransitionOverlay } from '@/components/vault/VaultTransitionOverlay'
import { VaultGallery } from '@/components/vault/VaultGallery'
import { VaultSetupModal } from '@/components/vault/VaultSetupModal'
import { ImageViewer } from './ImageViewer'
import { DeleteModal } from '@/components/ui/DeleteModal'

interface Props {
  chatId: string
  onBack?: () => void
}

export function ChatPanel({ chatId, onBack }: Props) {
  const { user } = useAuthStore()
  const { chats, typingUsers, updateMessage, activeHiddenChat } = useChatStore()
  const { setMobileChatOpen, chatLockEnabled, lockChat, isMobileChatOpen } = useUIStore()
  const setPendingVaultSetupChatId = useUIStore((s) => s.setPendingVaultSetupChatId)
  const { messages, handleTyping, loadMoreMessages, hasMore } = useMessages(chatId)
  const { isUnlocked, tryUnlockWithInput, lockVault } = useVault()
  useAutoVault(chatId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef(0)
  const [showVaultTransition, setShowVaultTransition] = useState(false)
  const [showVault, setShowVault] = useState(false)
  const [showVaultSetup, setShowVaultSetup] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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
  // Note: do NOT clear activeHiddenChat here — StrictMode also runs this cleanup on
  // the first fake unmount; activeHiddenChat is cleared by AppLayout instead.
  useEffect(() => {
    // Cancel a pending lock only when the same chatId is remounting (StrictMode cycle).
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

  // Scroll to bottom on new messages (skip when prepending old messages)
  useEffect(() => {
    if (prevScrollHeightRef.current > 0) return
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

      <div className="chat-body">
        <ChatHeader
          chat={chat}
          onBack={() => { setMobileChatOpen(false); onBack?.() }}
        />

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
