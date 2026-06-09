'use client'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { formatMessageTime } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { mediaProvider } from '@/lib/media'
import type { MessageWithSender } from '@/types/app'

interface Props {
  message: MessageWithSender
  isOwn: boolean
  vaultUnlocked: boolean
  onDelete?: (id: string) => void
}

function ReadTick({ readBy }: { readBy: string[] }) {
  const isRead = readBy.length > 0
  return (
    <span className={`bubble-read${isRead ? ' read' : ''}`}>
      {isRead ? '✓✓' : '✓'}
    </span>
  )
}

function LazyVideo({ src, poster, className }: { src: string; poster?: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Release buffered video data when the chat is navigated away from (vault flush)
  useEffect(() => {
    return () => {
      const vid = videoRef.current
      if (vid) {
        vid.pause()
        vid.src = ''
        vid.load()
      }
    }
  }, [])

  return (
    <div ref={containerRef} className="message-video-container">
      {inView ? (
        <video
          ref={videoRef}
          className={className}
          src={src}
          poster={poster}
          controls
          preload="metadata"
          playsInline
          muted
          controlsList="nodownload"
        />
      ) : (
        <div className="message-video-placeholder">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="message-video-thumb-img" />
          ) : (
            <div className="message-video-thumb-blank" />
          )}
          <div className="message-video-play-hint" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none">
              <polygon points="6 3 20 12 6 21 6 3"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}

export function MessageBubble({ message, isOwn, vaultUnlocked, onDelete }: Props) {
  const { setImageViewer } = useUIStore()
  const isPending = message.id.startsWith('__temp_')

  if (message.type === 'deleted') {
    return (
      <div className={`message-wrap ${isOwn ? 'outgoing' : ''}`} role="listitem">
        <div className={`bubble ${isOwn ? 'bubble-out' : 'bubble-in'}`}>
          <span className="bubble-deleted">
            {isOwn ? 'You deleted this message' : 'This message was deleted'}
          </span>
        </div>
      </div>
    )
  }

  if (message.type === 'video') {
    if (message.is_vaulted && !vaultUnlocked) return null

    return (
      <div
        className={`message-wrap ${isOwn ? 'outgoing' : ''}`}
        role="listitem"
        aria-label={`${isOwn ? 'You' : message.sender?.display_name ?? message.sender?.username ?? 'Them'} sent a video at ${formatMessageTime(message.created_at)}`}
      >
        <div className={`bubble bubble-video ${isOwn ? 'bubble-out' : 'bubble-in'}`}>
          {isPending ? (
            <div className="message-video-container">
              <div className="message-video-placeholder">
                {message.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={message.image_url} alt="" className="message-video-thumb-img" />
                ) : (
                  <div className="message-video-thumb-blank" />
                )}
                <div className="message-video-pending" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                </div>
              </div>
            </div>
          ) : message.image_url ? (
            <LazyVideo
              src={message.image_url}
              poster={message.image_path ? mediaProvider.getVideoThumbnailUrl(message.image_path) : undefined}
              className="message-video"
            />
          ) : null}
          <div className="bubble-meta">
            <span className="bubble-time">{formatMessageTime(message.created_at)}</span>
            {isOwn && !isPending && <ReadTick readBy={message.read_by} />}
          </div>
        </div>
      </div>
    )
  }

  if (message.type === 'image') {
    if (message.is_vaulted && !vaultUnlocked) return null

    return (
      <div
        className={`message-wrap ${isOwn ? 'outgoing' : ''}`}
        role="listitem"
        aria-label={`${isOwn ? 'You' : message.sender?.display_name ?? message.sender?.username ?? 'Them'} sent a photo at ${formatMessageTime(message.created_at)}`}
      >
        <div className={`bubble bubble-image ${isOwn ? 'bubble-out' : 'bubble-in'}`}>
          {message.image_url ? (
            <div style={{ cursor: 'pointer' }} onClick={() => setImageViewer(message.image_url!)}>
              <Image
                src={message.image_url}
                alt="Photo"
                width={260}
                height={200}
                style={{ borderRadius: 'calc(var(--r-xl) - 4px)', objectFit: 'cover', width: '100%', height: 'auto' }}
              />
            </div>
          ) : null}
          <div className="bubble-meta">
            <span className="bubble-time">{formatMessageTime(message.created_at)}</span>
            {isOwn && <ReadTick readBy={message.read_by} />}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`message-wrap ${isOwn ? 'outgoing' : ''}`}
      role="listitem"
      aria-label={`${isOwn ? 'You' : message.sender?.display_name ?? message.sender?.username ?? 'Them'}: ${message.content ?? ''} at ${formatMessageTime(message.created_at)}`}
      onContextMenu={(e) => {
        if (isOwn && onDelete) { e.preventDefault(); onDelete(message.id) }
      }}
    >
      <div className={`bubble ${isOwn ? 'bubble-out' : 'bubble-in'}`}>
        <span className="bubble-text">{message.content}</span>
        <div className="bubble-meta">
          <span className="bubble-time">{formatMessageTime(message.created_at)}</span>
          {isOwn && <ReadTick readBy={message.read_by} />}
        </div>
      </div>
    </div>
  )
}
