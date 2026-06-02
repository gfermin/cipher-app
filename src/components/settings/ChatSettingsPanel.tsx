'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { DeleteModal } from '@/components/ui/DeleteModal'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { deleteChat, updateChatTheme } from '@/services/chatService'
import { setVaultPassword } from '@/services/vaultService'
import { uploadAvatar } from '@/services/storageService'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { ChatWithParticipants } from '@/types/app'
import { CHAT_THEMES, SUPABASE_STORAGE } from '@/lib/constants'

const CHAT_THEME_COLORS: Record<string, string> = {
  default: 'linear-gradient(135deg, var(--bubble-out-from), var(--bubble-out-to))',
  purple: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  teal: 'linear-gradient(135deg, #14b8a6, #0f766e)',
  rose: 'linear-gradient(135deg, #f43f5e, #be123c)',
}

interface Props { chat: ChatWithParticipants }

export function ChatSettingsPanel({ chat }: Props) {
  const router = useRouter()
  const { user } = useAuthStore()
  const { chatSettingsOpen, setChatSettings, showToast } = useUIStore()
  const { updateChatTheme: updateThemeInStore, removeChat } = useChatStore()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [vaultPin, setVaultPin] = useState('')
  const [settingVault, setSettingVault] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)
  const supabase = getSupabaseClient()

  const { otherUser, myPreferences } = chat

  async function handleThemeChange(themeId: string) {
    const newTheme = themeId === 'default' ? null : themeId
    await updateChatTheme(chat.id, newTheme).catch(() => {})
    updateThemeInStore(chat.id, newTheme)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteChat(chat.id)
      removeChat(chat.id)
      setChatSettings(false)
      router.push('/chats')
    } catch {
      showToast('Failed to delete conversation', 'error')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  async function handleSetVaultPassword(e: React.FormEvent) {
    e.preventDefault()
    if (vaultPin.length !== 6) return
    setSettingVault(true)
    try {
      await setVaultPassword(chat.id, vaultPin)
      setVaultPin('')
      showToast('Vault password set', 'success')
    } catch {
      showToast('Failed to set vault password', 'error')
    } finally {
      setSettingVault(false)
    }
  }

  async function handlePrivateAvatar(file: File | undefined) {
    if (!file || !user) return
    try {
      const { url } = await uploadAvatar(file, user.id, `private/${chat.id}`)
      await supabase
        .from('chat_user_preferences')
        .upsert({ chat_id: chat.id, user_id: user.id, private_avatar: url })
      showToast('Private avatar updated', 'success')
    } catch {
      showToast('Failed to upload avatar', 'error')
    }
  }

  const currentTheme = chat.custom_theme ?? 'default'

  return (
    <>
      {chatSettingsOpen && (
        <div className="settings-backdrop" onClick={() => setChatSettings(false)} />
      )}

      <div className={`chat-settings-panel ${chatSettingsOpen ? 'open' : ''}`}>
        <div className="cs-header">
          <button
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', color: 'var(--text-2)' }}
            onClick={() => setChatSettings(false)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
          <span className="cs-title">Conversation Info</span>
        </div>

        {/* Contact card */}
        <div className="cs-section">
          <div className="cs-avatar-card">
            <Avatar
              src={myPreferences?.private_avatar ?? otherUser.public_avatar}
              name={otherUser.display_name ?? otherUser.username}
              size={72}
            />
            <div className="cs-name">{otherUser.display_name ?? otherUser.username}</div>
            <div className="cs-status">@{otherUser.username}</div>
          </div>
        </div>

        {/* Private avatar */}
        <div className="cs-section">
          <div className="cs-section-title">Private Avatar</div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 12 }}>
            Exclusive to this conversation
          </p>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => handlePrivateAvatar(e.target.files?.[0])}
          />
          <button
            className="vault-set-btn"
            onClick={() => avatarRef.current?.click()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload Private Avatar
          </button>
        </div>

        {/* Chat theme */}
        <div className="cs-section">
          <div className="cs-section-title">Chat Theme</div>
          <div className="theme-swatches">
            {CHAT_THEMES.map((t) => (
              <button
                key={t.id}
                className={`theme-swatch ${currentTheme === t.id ? 'active' : ''}`}
                style={{ background: CHAT_THEME_COLORS[t.id] }}
                onClick={() => handleThemeChange(t.id)}
                title={t.label}
              >
                {currentTheme === t.id && '✓'}
              </button>
            ))}
          </div>
        </div>

        {/* Vault password */}
        <div className="cs-section">
          <div className="cs-section-title">Vault Password</div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 12 }}>
            Set a 6-digit PIN to protect photos in this chat.
          </p>
          <form onSubmit={handleSetVaultPassword} style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              placeholder="6-digit PIN"
              value={vaultPin}
              onChange={(e) => setVaultPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{
                flex: 1, padding: '8px 12px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', color: 'var(--text-1)',
                fontSize: 'var(--text-base)', letterSpacing: 8,
              }}
            />
            <button
              type="submit"
              className="vault-set-btn"
              style={{ width: 'auto', padding: '8px 16px' }}
              disabled={vaultPin.length !== 6 || settingVault}
            >
              {settingVault ? '…' : 'Set'}
            </button>
          </form>
        </div>

        {/* Delete */}
        <div className="cs-section">
          <button className="danger-btn" onClick={() => setShowDeleteModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Delete Conversation
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteModal
          title="Delete conversation?"
          description={`This will permanently delete all messages, photos, and vault data with ${otherUser.display_name ?? otherUser.username}. This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}
    </>
  )
}
