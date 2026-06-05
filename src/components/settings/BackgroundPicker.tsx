'use client'
import { useRef, useState } from 'react'

interface Props {
  label: string
  description?: string
  currentUrl: string | null
  userId: string
  chatId?: string
  onSave: (url: string) => Promise<void>
  onRemove: () => Promise<void>
}

export function BackgroundPicker({ label, description, currentUrl, userId, chatId, onSave, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const { uploadBackground } = await import('@/services/storageService')
      const { url } = await uploadBackground(file, userId, chatId)
      await onSave(url)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await onRemove()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="bg-picker">
      <div className="bg-picker-header">
        <div>
          <div className="bg-picker-label">{label}</div>
          {description && <div className="bg-picker-desc">{description}</div>}
        </div>
        {currentUrl && (
          <button
            className="bg-picker-remove"
            onClick={handleRemove}
            disabled={removing}
            aria-label="Remove background"
          >
            {removing ? (
              <span className="btn-spinner" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            )}
          </button>
        )}
      </div>

      {currentUrl && (
        <div className="bg-picker-preview" style={{ backgroundImage: `url(${currentUrl})` }} aria-label="Current background preview" />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        className="vault-set-btn"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <span className="btn-spinner" />
            Uploading…
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {currentUrl ? 'Change Background' : 'Set Background'}
          </>
        )}
      </button>
    </div>
  )
}
