'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getVaultedMessages } from '@/services/messageService'
import { useUIStore } from '@/stores/uiStore'
import { formatMessageTime } from '@/lib/utils'
import type { MessageWithSender } from '@/types/app'

interface Props {
  chatId: string
  onClose: () => void
}

export function VaultGallery({ chatId, onClose }: Props) {
  const { setImageViewer } = useUIStore()
  const [items, setItems] = useState<MessageWithSender[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getVaultedMessages(chatId)
      .then(setItems)
      .finally(() => setLoading(false))

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [chatId, onClose])

  return (
    <div className="vault-gallery">
      <div className="vault-gallery-header">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--vault-accent)" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span className="vault-gallery-title">Vault</span>
        <button className="vault-close-btn" onClick={onClose} aria-label="Close vault">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="vault-gallery-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '1', borderRadius: 'var(--r-md)' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--vault-accent)', opacity: 0.5 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span style={{ fontSize: 'var(--text-sm)' }}>Vault is empty</span>
        </div>
      ) : (
        <div className="vault-gallery-grid">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="vault-item"
              style={{ animationDelay: `${i * 80}ms` }}
              onClick={() => item.image_url && setImageViewer(item.image_url)}
              title={formatMessageTime(item.created_at)}
            >
              {item.image_url && (
                <Image
                  src={item.image_url}
                  alt="Vault photo"
                  width={200}
                  height={200}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
