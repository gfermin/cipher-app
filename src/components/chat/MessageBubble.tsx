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
    const isVaulted = message.is_vaulted && !vaultUnlocked

    return (
      <div className={`message-wrap ${isOwn ? 'outgoing' : ''}`}>
        <div className={`bubble bubble-image ${isOwn ? 'bubble-out' : 'bubble-in'}`}>
          {isVaulted ? (
            <div className="bubble-vault">
              <span>🔒</span>
              <span>Photo in vault</span>
            </div>
          ) : message.image_url ? (
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
          {isOwn && (
            <span className={`bubble-read ${message.read_by.length > 1 ? 'read' : ''}`}>
              ✓✓
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
