'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/uiStore'
import { verifyUserVaultCode, hasUserVaultCode } from '@/services/vaultService'

const PIN_LEN = 6

interface Props {
  chatId: string
  onClose: () => void
  onUnlocked?: () => void
}

export function ChatUnlockModal({ chatId, onClose, onUnlocked }: Props) {
  const router = useRouter()
  const { unlockChat, setPendingVaultSetupChatId } = useUIStore()

  const [digits, setDigits] = useState<string[]>(Array(PIN_LEN).fill(''))
  const [codeError, setCodeError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [checking, setChecking] = useState(false)
  // null = loading, false = code exists, true = no code set
  const [noCode, setNoCode] = useState<boolean | null>(null)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])
  const sheetRef = useRef<HTMLDivElement>(null)

  // Check vault code existence on mount and focus first input
  useEffect(() => {
    hasUserVaultCode(chatId)
      .then((exists) => {
        setNoCode(!exists)
        if (exists) setTimeout(() => pinRefs.current[0]?.focus(), 60)
      })
      .catch(() => {
        setNoCode(false)
        setTimeout(() => pinRefs.current[0]?.focus(), 60)
      })
  }, [chatId])

  // Focus trap + Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'Tab' && sheetRef.current) {
        const focusable = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)')
        )
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus() }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus() }
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function triggerShake() {
    setShaking(true)
    setTimeout(() => setShaking(false), 350)
  }

  function handleDigitChange(idx: number, rawValue: string) {
    if (checking) return
    const digit = rawValue.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = digit
    setDigits(next)
    if (digit && idx < PIN_LEN - 1) pinRefs.current[idx + 1]?.focus()
    if (next.every(d => d !== '')) submitCode(next.join(''))
  }

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits]; next[idx] = ''; setDigits(next)
      } else if (idx > 0) {
        pinRefs.current[idx - 1]?.focus()
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    if (checking) return
    e.preventDefault()
    const raw = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LEN)
    const next = Array(PIN_LEN).fill('')
    for (let i = 0; i < raw.length; i++) next[i] = raw[i]
    setDigits(next)
    pinRefs.current[Math.min(raw.length, PIN_LEN - 1)]?.focus()
    if (raw.length === PIN_LEN) submitCode(raw)
  }

  async function submitCode(code: string) {
    setChecking(true)
    setCodeError(null)
    const result = await verifyUserVaultCode(chatId, code)
    setChecking(false)

    if (result === 'rate_limited') {
      setCodeError('Too many attempts. Try again in 60 seconds.')
      setDigits(Array(PIN_LEN).fill(''))
      triggerShake()
      return
    }

    if (result === null) {
      // Code was deleted between check and verify
      setNoCode(true)
      return
    }

    if (result === false) {
      setCodeError('Incorrect code.')
      setDigits(Array(PIN_LEN).fill(''))
      triggerShake()
      setTimeout(() => pinRefs.current[0]?.focus(), 60)
      return
    }

    // Correct code — unlock only this chat temporarily
    unlockChat(chatId)
    if (onUnlocked) {
      onUnlocked()
    } else {
      router.push(`/chats/${chatId}`)
      onClose()
    }
  }

  function handleSetupVaultCode() {
    setPendingVaultSetupChatId(chatId)
    unlockChat(chatId)
    if (onUnlocked) {
      onUnlocked()
    } else {
      router.push(`/chats/${chatId}`)
      onClose()
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Unlock chat" ref={sheetRef}>
        <div className="sheet-handle" />

        {/* Loading — checking if vault code exists */}
        {noCode === null && (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0' }}>
            <div className="sheet-spinner" />
          </div>
        )}

        {/* Vault code exists — show PIN input */}
        {noCode === false && (
          <>
            <div className="sheet-title">Enter lock code</div>
            <div className="sheet-sub">Enter your 6-digit lock code to open this chat.</div>

            {codeError && (
              <div className="sheet-validation-msg err" role="alert" style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
                {codeError}
              </div>
            )}

            <div className="vault-pin-group">
              <div className="vault-pin-label">Lock code</div>
              <div className={`vault-pin-row${shaking ? ' vault-pin-row--shake' : ''}`}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { pinRefs.current[i] = el }}
                    className={`vault-pin-box${checking ? ' vault-pin-box--done' : ''}`}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    onPaste={handlePaste}
                    aria-label={`Lock code digit ${i + 1} of ${PIN_LEN}`}
                    disabled={checking}
                    autoComplete="off"
                  />
                ))}
              </div>
            </div>

            <div className="sheet-actions" style={{ marginTop: 'var(--sp-5)' }}>
              <button className="btn-secondary" onClick={onClose} disabled={checking}>
                Cancel
              </button>
            </div>
          </>
        )}

        {/* No vault code set for this chat */}
        {noCode === true && (
          <>
            <div className="sheet-title">No lock code set</div>
            <div className="sheet-sub">
              Set up a vault code to enable locking for this chat.
            </div>
            <div className="sheet-actions" style={{ marginTop: 'var(--sp-5)' }}>
              <button className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="auth-btn"
                onClick={handleSetupVaultCode}
                style={{ marginTop: 0 }}
              >
                Set up vault code
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
