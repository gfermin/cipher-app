import type { MediaProvider, UploadResult } from './types'

function cloudName(): string {
  return process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''
}

function uploadPreset(): string {
  return process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? ''
}

export const cloudinaryProvider: MediaProvider = {
  async uploadImage(file: File, folder: string, filename: string): Promise<UploadResult> {
    if (!cloudName() || !uploadPreset()) {
      throw new Error('Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', uploadPreset())
    formData.append('public_id', `${folder}/${filename}`)

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName()}/image/upload`,
      { method: 'POST', body: formData }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(err.error?.message ?? 'Cloudinary upload failed')
    }

    const data = await res.json() as { secure_url: string; public_id: string }
    return {
      url: data.secure_url,
      path: data.public_id,
    }
  },

  async deleteImage(publicId: string): Promise<void> {
    if (!publicId) return
    const res = await fetch('/api/media/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id: publicId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? 'Media deletion failed')
    }
  },

  getImageUrl(publicIdOrUrl: string): string {
    if (publicIdOrUrl.startsWith('http')) return publicIdOrUrl
    return `https://res.cloudinary.com/${cloudName()}/image/upload/${publicIdOrUrl}`
  },
}
