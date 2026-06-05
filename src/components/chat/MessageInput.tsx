'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import { sendTextMessage, sendImageMessage } from '@/services/messageService'
import { uploadChatImage } from '@/services/storageService'
import { VAULT_PASSWORD_PATTERN, VAULT_SETUP_COMMAND } from '@/lib/constants'

interface Props {
  chatId: string
  onTyping?: () => void
  onVaultTrigger: (password: string) => Promise<boolean>
  onVaultSetupTrigger: () => void
}

export function MessageInput({ chatId, onTyping, onVaultTrigger, onVaultSetupTrigger }: Props) {
  const { user } = useAuthStore()
  const { showToast } = useUIStore()
  const { addMessage, updateLastMessage } = useChatStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  useEffect(() => { autoResize() }, [text])

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || !user || sending) return

    // Command registry — evaluated in order, each exits before the normal send path
    if (trimmed === VAULT_SETUP_COMMAND) {
      setText('')
      onVaultSetupTrigger()
      return
    }

    if (VAULT_PASSWORD_PATTERN.test(trimmed)) {
      setText('')
      const unlocked = await onVaultTrigger(trimmed)
      if (!unlocked) showToast('Incorrect vault password', 'error')
      return
    }

    setSending(true)
    setText('')
    try {
      const msg = await sendTextMessage(chatId, user.id, trimmed)
      addMessage(chatId, msg)
      updateLastMessage(chatId, msg)
    } catch {
      showToast('Failed to send message', 'error')
      setText(trimmed)
    } finally {
      setSending(false)
    }
  }, [text, user, sending, chatId, onVaultTrigger, showToast, addMessage, updateLastMessage])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleImageFile(file: File | undefined) {
    if (!file || !user) return
    setUploading(true)
    try {
      const { url, path } = await uploadChatImage(file, chatId, user.id)
      const msg = await sendImageMessage(chatId, user.id, url, path)
      addMessage(chatId, msg)
      updateLastMessage(chatId, msg)
    } catch {
      showToast('Failed to send image', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="input-area">
      {/* Hidden file inputs */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleImageFile(e.target.files?.[0])}
        tabIndex={-1}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => handleImageFile(e.target.files?.[0])}
        tabIndex={-1}
      />

      <button
        className="input-icon-btn"
        type="button"
        onClick={() => cameraRef.current?.click()}
        aria-label="Camera"
        title="Take photo"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>

      <div className="input-wrap">
        <textarea
          ref={textareaRef}
          className="message-textarea"
          placeholder="Message"
          aria-label="Message"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            onTyping?.()
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          autoComplete="off"
          autoCorrect="off"
          spellCheck
          disabled={uploading}
        />

        <button
          className="input-icon-btn"
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach image"
          title="Attach image"
          disabled={uploading}
        >
          {uploading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          )}
        </button>
      </div>

      <button
        className="send-btn"
        type="button"
        onClick={handleSend}
        disabled={!text.trim() || sending}
        aria-label="Send"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  )
}
