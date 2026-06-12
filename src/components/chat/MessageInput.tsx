'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import { sendTextMessage, sendImageMessage, sendVideoMessage } from '@/services/messageService'
import { uploadChatImage, uploadChatVideo } from '@/services/storageService'
import type { MessageWithSender } from '@/types/app'

interface Props {
  chatId: string
  onTyping?: () => void
  onVaultTrigger: (password: string) => Promise<boolean>
  onVaultSetupTrigger: () => void
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url)
      reject(new Error('timed out'))
    }, 5000)
    video.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      resolve(video.duration)
    })
    video.addEventListener('error', () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      reject(new Error('load error'))
    })
    video.src = url
  })
}

function extractVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    let done = false
    const finish = (result: string) => {
      if (done) return
      done = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(result)
    }
    const timer = setTimeout(() => finish(''), 6000)
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(0.5, video.duration * 0.1)
    })
    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 225
      canvas.getContext('2d')?.drawImage(video, 0, 0, 400, 225)
      finish(canvas.toDataURL('image/jpeg', 0.7))
    })
    video.addEventListener('error', () => finish(''))
    video.src = url
  })
}

export function MessageInput({ chatId, onTyping, onVaultTrigger, onVaultSetupTrigger }: Props) {
  const { user } = useAuthStore()
  const { showToast } = useUIStore()
  const { addMessage, updateLastMessage, removeMessage } = useChatStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [videoUploading, setVideoUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

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
    if (trimmed === 'secret_vault') {
      setText('')
      onVaultSetupTrigger()
      return
    }

    if (/^\d{6}$/.test(trimmed)) {
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

  async function handleVideoFile(file: File | undefined) {
    if (!file || !user) return

    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime']
    if (!validTypes.includes(file.type)) {
      showToast('Unsupported video format', 'error')
      if (videoRef.current) videoRef.current.value = ''
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      showToast('Video too large. Maximum 50 MB.', 'error')
      if (videoRef.current) videoRef.current.value = ''
      return
    }

    let duration: number
    try {
      duration = await getVideoDuration(file)
    } catch {
      showToast('Could not read video file.', 'error')
      if (videoRef.current) videoRef.current.value = ''
      return
    }

    if (duration > 180) {
      showToast('Video must be under 3 minutes.', 'error')
      if (videoRef.current) videoRef.current.value = ''
      return
    }

    // Extract a local thumbnail frame for the optimistic placeholder
    const thumbUrl = await extractVideoThumbnail(file)
    const tempId = `__temp_${Date.now()}`
    const placeholder: MessageWithSender = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      type: 'video',
      image_url: thumbUrl || null,
      image_path: null,
      content: null,
      content_tsv: null,
      created_at: new Date().toISOString(),
      is_vaulted: false,
      is_deleted: false,
      read_by: [],
      sender: user.profile,
    }
    addMessage(chatId, placeholder)

    setVideoUploading(true)
    try {
      const { url, path } = await uploadChatVideo(file, chatId, user.id)
      const msg = await sendVideoMessage(chatId, user.id, url, path)
      removeMessage(chatId, tempId)
      addMessage(chatId, msg)
      updateLastMessage(chatId, msg)
    } catch {
      removeMessage(chatId, tempId)
      showToast('Failed to send video', 'error')
    } finally {
      setVideoUploading(false)
      if (videoRef.current) videoRef.current.value = ''
    }
  }

  const busy = uploading || videoUploading

  return (
    <div className="input-area">
      {videoUploading && (
        <div className="video-upload-status">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Sending video…
        </div>
      )}

      <div className="input-row">
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
        <input
          ref={videoRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="sr-only"
          onChange={(e) => handleVideoFile(e.target.files?.[0])}
          tabIndex={-1}
        />

        <button
          className="input-icon-btn"
          type="button"
          onClick={() => cameraRef.current?.click()}
          aria-label="Camera"
          title="Take photo"
          disabled={busy}
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
            disabled={busy}
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

          <button
            className="input-icon-btn"
            type="button"
            onClick={() => videoRef.current?.click()}
            aria-label="Attach video"
            title="Attach video"
            disabled={busy}
          >
            {videoUploading ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
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
    </div>
  )
}
