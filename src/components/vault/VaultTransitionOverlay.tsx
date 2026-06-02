'use client'
import { useEffect } from 'react'

interface Props { onComplete: () => void }

export function VaultTransitionOverlay({ onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(onComplete, 900)
    return () => clearTimeout(t)
  }, [onComplete])

  return (
    <div className="vault-transition-overlay">
      <div className="vault-transition-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          <circle cx="12" cy="16" r="1" fill="currentColor"/>
        </svg>
      </div>
    </div>
  )
}
