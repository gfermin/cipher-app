'use client'
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useTheme } from '@/hooks/useTheme'
import { updateProfile, signOut } from '@/services/authService'
import { AvatarUpload } from '@/components/settings/AvatarUpload'
import { ThemeSelector } from '@/components/settings/ThemeSelector'
import { useRouter } from 'next/navigation'

interface Props { onBack?: () => void }

const TABS = ['Profile', 'Appearance', 'About'] as const
type Tab = (typeof TABS)[number]

export function SettingsView({ onBack }: Props) {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const { showToast } = useUIStore()
  const [tab, setTab] = useState<Tab>('Profile')
  const [displayName, setDisplayName] = useState<string>(user?.profile.display_name ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const dn = displayName.trim() || null
      await updateProfile({ display_name: dn })
      if (user) {
        setUser({ ...user, profile: { ...user.profile, display_name: dn } })
      }
      showToast('Profile updated', 'success')
    } catch {
      showToast('Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await signOut().catch(() => {})
    setUser(null)
    router.push('/login')
  }

  return (
    <div className="settings-screen">
      <div className="sidebar-header" style={{ minHeight: 64, borderBottom: '1px solid var(--border)' }}>
        {onBack && (
          <button className="mobile-back-btn" style={{ display: 'flex' }} onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        )}
        <span className="sidebar-title">Settings</span>
      </div>

      <nav className="settings-nav">
        {TABS.map((t) => (
          <button
            key={t}
            className={`settings-nav-item ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {tab === 'Profile' && (
          <div className="settings-section">
            <div className="setting-row" style={{ marginBottom: 24 }}>
              <AvatarUpload />
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="setting-row">
                <div className="setting-label">
                  <div className="setting-label-title">Display Name</div>
                  <div className="setting-label-sub">Visible to everyone</div>
                </div>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={user?.profile.username ?? ''}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    color: 'var(--text-1)',
                    fontSize: 'var(--text-sm)',
                    width: 140,
                  }}
                />
              </div>

              <button
                type="submit"
                className="auth-btn"
                style={{ marginTop: 12 }}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>

            <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
              <button
                className="danger-btn"
                onClick={handleSignOut}
                style={{ marginTop: 0 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        )}

        {tab === 'Appearance' && (
          <div className="settings-section">
            <div style={{ marginBottom: 16, fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
              Choose your theme. Each family has a dark and light variant.
            </div>
            <ThemeSelector />
          </div>
        )}

        {tab === 'About' && (
          <div className="settings-section">
            <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div className="setting-label-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Cipher</div>
              <div className="setting-label-sub">Private messaging for the people you trust.</div>
              <div className="setting-label-sub" style={{ marginTop: 8 }}>Version 1.0.0</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
