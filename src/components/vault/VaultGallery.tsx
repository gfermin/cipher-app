'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getVaultedMessages } from '@/services/messageService'
import { deleteVaultImage } from '@/services/vaultService'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import { getSupabaseClient } from '@/lib/supabase/client'
import { DeleteModal } from '@/components/ui/DeleteModal'
import { formatMessageTime } from '@/lib/utils'
import type { MessageWithSender } from '@/types/app'

interface Props {
  chatId: string
  onClose: () => void
}

export function VaultGallery({ chatId, onClose }: Props) {
  const { setImageViewer, vault } = useUIStore()
  const { removeMessage } = useChatStore()
  const [items, setItems] = useState<MessageWithSender[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingItem, setDeletingItem] = useState<MessageWithSender | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (!vault.vaultToken) { setLoading(false); return }
    getVaultedMessages(chatId, vault.vaultToken)
      .then(setItems)
      .finally(() => setLoading(false))

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [chatId, onClose, vault.vaultToken])

  // Realtime: remove items deleted by the other participant while gallery is open
  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel(`vault-gallery:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setItems((prev) => prev.filter((i) => i.id !== (payload.old as { id: string }).id))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [chatId])

  async function handleDeleteConfirm() {
    if (!deletingItem) return
    setDeleteLoading(true)
    try {
      await deleteVaultImage(deletingItem.id)
      setItems((prev) => prev.filter((i) => i.id !== deletingItem.id))
      removeMessage(chatId, deletingItem.id)
    } catch {
      // row may already be gone — swallow silently
    } finally {
      setDeleteLoading(false)
      setDeletingItem(null)
    }
  }

  return (
    <>
      <div className="vault-gallery" role="region" aria-label="Vault gallery">
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
          <div className="vault-gallery-grid" role="list" aria-label="Vault photos">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="vault-item"
                role="listitem"
                style={{ animationDelay: `${i * 80}ms` }}
                onClick={() => item.image_url && setImageViewer(item.image_url)}
                title={formatMessageTime(item.created_at)}
                aria-label={`Vault photo from ${formatMessageTime(item.created_at)}`}
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
                <button
                  className="vault-item-delete"
                  onClick={(e) => { e.stopPropagation(); setDeletingItem(item) }}
                  aria-label="Delete photo"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {deletingItem && (
        <DeleteModal
          title="Delete photo"
          description="Delete this photo permanently? It cannot be recovered."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingItem(null)}
          loading={deleteLoading}
        />
      )}
    </>
  )
}
