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

  function handleFileSelect(file: File | undefined) {
    if (!file || !user) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string | undefined
      if (src) setPendingImageSrc(src)
    }
    reader.readAsDataURL(file)
    // Reset input so the same file can be re-selected after cancel
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleCropConfirm(blob: Blob) {
    if (!user) return
    setPendingImageSrc(null)
    try {
      const cropped = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      const { url } = await uploadAvatar(cropped, user.id, 'public')
      const sb = getSupabaseClient()
      await sb.from('profiles').update({ public_avatar: url, updated_at: new Date().toISOString() }).eq('id', user.id)
      setUser({ ...user, profile: { ...user.profile, public_avatar: url } })
      showToast('Avatar updated', 'success')
    } catch {
      showToast('Failed to upload avatar', 'error')
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
          style={{ position: 'relative', cursor: 'pointer' }}
          onClick={() => fileRef.current?.click()}
          title="Change avatar"
        >
          <Avatar
            src={user.profile.public_avatar}
            name={user.profile.display_name ?? user.profile.username}
            size={64}
          />
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-1)' }}>
            {user.profile.display_name ?? user.profile.username}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
            @{user.profile.username}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--accent-light)', background: 'none', cursor: 'pointer' }}
          >
            Change photo
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
