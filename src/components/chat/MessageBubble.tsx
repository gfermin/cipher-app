'use client'
import Image from 'next/image'
import { formatMessageTime } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
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

export function MessageBubble({ message, isOwn, vaultUnlocked, onDelete }: Props) {
  const { setImageViewer } = useUIStore()

  if (message.type === 'deleted') {
    return (
      <div className={`message-wrap ${isOwn ? 'outgoing' : ''}`}>
        <div className={`bubble ${isOwn ? 'bubble-out' : 'bubble-in'}`}>
          <span className="bubble-deleted">
            {isOwn ? 'You deleted this message' : 'This message was deleted'}
          </span>
        </div>
      </div>
    )
  }

  if (message.type === 'image') {
    if (message.is_vaulted && !vaultUnlocked) return null

    return (
      <div className={`message-wrap ${isOwn ? 'outgoing' : ''}`}>
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
