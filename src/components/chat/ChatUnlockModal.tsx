'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/uiStore'
import { verifyUserVaultCode, hasUserVaultCode } from '@/services/vaultService'
import { verifyAccountPassword } from '@/services/authService'

const PIN_LEN = 6
const SESSION_TTL_MS = 5 * 60 * 1000
const MAX_PW_ATTEMPTS = 5

type Step = 'password' | 'code'

interface Props {
  chatId: string
  onClose: () => void
  onUnlocked?: () => void
}

export function ChatUnlockModal({ chatId, onClose, onUnlocked }: Props) {
  const router = useRouter()
  const {
    unlockChat,
    setPendingVaultSetupChatId,
    chatLockSession,
    setChatLockSession,
  } = useUIStore()

  function getInitialStep(): Step {
    if (chatLockSession && Date.now() - chatLockSession.verifiedAt < SESSION_TTL_MS) return 'code'
    return 'password'
  }

  const [step, setStep] = useState<Step>(getInitialStep)

  // Step 1 — account password
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwChecking, setPwChecking] = useState(false)
  const [pwAttempts, setPwAttempts] = useState(0)
  const pwInputRef = useRef<HTMLInputElement>(null)

  // Step 2 — vault code
  const [digits, setDigits] = useState<string[]>(Array(PIN_LEN).fill(''))
  const [codeError, setCodeError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [checking, setChecking] = useState(false)
  // null = loading, false = code exists, true = no code set
  const [noCode, setNoCode] = useState<boolean | null>(null)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])

  const sheetRef = useRef<HTMLDivElement>(null)

  // Auto-focus on step entry
  useEffect(() => {
    if (step === 'password') {
      setTimeout(() => pwInputRef.current?.focus(), 60)
    }
  }, [step])

  // Check vault code existence when entering Step 2
  useEffect(() => {
    if (step !== 'code') return
    hasUserVaultCode(chatId)
      .then((exists) => {
        setNoCode(!exists)
        if (exists) setTimeout(() => pinRefs.current[0]?.focus(), 60)
      })
      .catch(() => {
        setNoCode(false)
        setTimeout(() => pinRefs.current[0]?.focus(), 60)
      })
  }, [chatId, step])

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

  // ── Step 1: Account password ────────────────────────────────────────────────

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim() || pwChecking || pwAttempts >= MAX_PW_ATTEMPTS) return
    setPwChecking(true)
    setPwError(null)
    const ok = await verifyAccountPassword(password)
    setPwChecking(false)
    if (ok) {
      setChatLockSession({ verifiedAt: Date.now() })
      setStep('code')
    } else {
      const next = pwAttempts + 1
      setPwAttempts(next)
      setPassword('')
      setPwError(next >= MAX_PW_ATTEMPTS ? 'Too many failed attempts.' : 'Incorrect password.')
      setTimeout(() => pwInputRef.current?.focus(), 60)
    }
  }

  // ── Step 2: Vault code ──────────────────────────────────────────────────────

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

    // Success
    unlockChat(chatId)
    if (onUnlocked) {
      onUnlocked()
    } else {
      router.push(`/chats/${chatId}`)
      onClose()
    }
  }

  function handleOpenWithoutCode() {
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

        {/* ── Step 1: Verify identity ── */}
        {step === 'password' && (
          <>
            <div className="sheet-title">Verify identity</div>
            <div className="sheet-sub">
              Enter your account password to access this chat.
            </div>

            {pwError && (
              <div className="sheet-validation-msg err" role="alert" style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
                {pwError}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <input
                ref={pwInputRef}
                className={`sheet-input${pwError ? ' error' : ''}`}
                type="password"
                placeholder="Account password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwError(null) }}
                disabled={pwChecking || pwAttempts >= MAX_PW_ATTEMPTS}
                autoComplete="current-password"
                aria-label="Account password"
              />
              <div className="sheet-actions" style={{ marginTop: 'var(--sp-2)' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={pwChecking}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="auth-btn"
                  style={{ marginTop: 0 }}
                  disabled={!password.trim() || pwChecking || pwAttempts >= MAX_PW_ATTEMPTS}
                >
                  {pwChecking
                    ? <span className="sheet-spinner" style={{ margin: '0 auto', display: 'block' }} />
                    : 'Verify'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Step 2: Vault code ── */}
        {step === 'code' && (
          <>
            {noCode === null && (
              <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0' }}>
                <div className="sheet-spinner" />
              </div>
            )}

            {noCode === false && (
              <>
                <div className="sheet-title">Enter lock code</div>
                <div className="sheet-sub">Enter your 6-digit vault code to open this chat.</div>

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
                    onClick={handleOpenWithoutCode}
                    style={{ marginTop: 0 }}
                  >
                    Set up vault code
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
