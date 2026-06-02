'use client'
import Image from 'next/image'
import { useUIStore } from '@/stores/uiStore'
import { useEffect } from 'react'

export function ImageViewer() {
  const { imageViewerUrl, setImageViewer } = useUIStore()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setImageViewer(null)
    }
    if (imageViewerUrl) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [imageViewerUrl, setImageViewer])

  if (!imageViewerUrl) return null

  return (
    <div className="image-viewer" onClick={() => setImageViewer(null)}>
      <button
        className="image-viewer-close"
        onClick={() => setImageViewer(null)}
        aria-label="Close"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
      <Image
        src={imageViewerUrl}
        alt="Full size"
        width={1200}
        height={900}
        style={{ objectFit: 'contain', maxWidth: '90vw', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
