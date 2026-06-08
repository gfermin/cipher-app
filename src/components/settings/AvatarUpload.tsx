'use client'
import { useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { ImageCropModal } from '@/components/ui/ImageCropModal'
import { uploadAvatar } from '@/services/storageService'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { getSupabaseClient } from '@/lib/supabase/client'

export function AvatarUpload() {
  const { user, setUser } = useAuthStore()
  const { showToast } = useUIStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  function handleFileSelect(file: File | undefined) {
    if (!file || !user || uploading) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string | undefined
      if (src) setPendingImageSrc(src)
    }
    reader.readAsDataURL(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleCropConfirm(blob: Blob) {
    if (!user) return
    setPendingImageSrc(null)
    setUploading(true)
    try {
      const cropped = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      const { url } = await uploadAvatar(cropped, user.id, 'public')
      const sb = getSupabaseClient()
      await sb.from('profiles').update({ public_avatar: url, updated_at: new Date().toISOString() }).eq('id', user.id)
      setUser({ ...user, profile: { ...user.profile, public_avatar: url } })
      showToast('Avatar updated', 'success')
    } catch {
      showToast('Failed to upload avatar', 'error')
    } finally {
      setUploading(false)
    }
  }

  function handleCropCancel() {
    setPendingImageSrc(null)
  }

  if (!user) return null

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          className="avatar-upload-wrap"
          style={{ cursor: uploading ? 'default' : 'pointer' }}
          onClick={() => { if (!uploading) fileRef.current?.click() }}
          title={uploading ? 'Uploading…' : 'Change avatar'}
        >
          <Avatar
            src={user.profile.public_avatar}
            name={user.profile.display_name ?? user.profile.username}
            size={64}
          />
          {uploading && (
            <div className="avatar-upload-overlay" aria-hidden="true">
              <span className="btn-spinner" />
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-1)' }}>
            {user.profile.display_name ?? user.profile.username}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
            @{user.profile.username}
          </div>
          <button
            onClick={() => { if (!uploading) fileRef.current?.click() }}
            disabled={uploading}
            style={{
              marginTop: 4,
              fontSize: 'var(--text-xs)',
              color: uploading ? 'var(--text-3)' : 'var(--accent-light)',
              background: 'none',
              cursor: uploading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {uploading ? (
              <>
                <span className="btn-spinner btn-spinner--accent" style={{ width: 12, height: 12 }} />
                Uploading…
              </>
            ) : (
              'Change photo'
            )}
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />
      </div>

      {pendingImageSrc && (
        <ImageCropModal
          imageSrc={pendingImageSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </>
  )
}
