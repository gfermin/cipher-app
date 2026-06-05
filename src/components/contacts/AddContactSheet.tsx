'use client'
import { useState } from 'react'
import { lookupContactCode } from '@/services/contactCodeService'
import { sendContactRequest } from '@/services/contactRequestService'

// CXXX-XXXX-XXXX-XXX format: C prefix + 14 chars from 31-char alphabet
// Alphabet: 2-9 + A-Z minus O, I, L
const CODE_RE = /^C[2-9A-HJ-KM-NP-Z]{3}-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{3}$/i

type Phase = 'idle' | 'looking' | 'confirming' | 'sending' | 'sent' | 'error'

interface Props {
  onClose: () => void
}

export function AddContactSheet({ onClose }: Props) {
  const [codeInput, setCodeInput] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lookupToken, setLookupToken] = useState<string | null>(null)

  const code = codeInput.trim().toUpperCase()
  const isValidFormat = CODE_RE.test(code)

  function validationMessage(): { text: string; ok: boolean } | null {
    if (!code) return null
    if (isValidFormat) return { text: 'Looks like a valid Cipher code', ok: true }
    if (code.length >= 18) return { text: "That doesn't look like a Cipher code", ok: false }
    return null
  }

  async function handleLookup() {
    if (!isValidFormat) return
    setPhase('looking')
    setErrorMsg(null)
    try {
      const token = await lookupContactCode(code)
      setLookupToken(token)
      setPhase('confirming')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setErrorMsg(
        msg === 'rate_limited'  ? 'Too many attempts. Wait a moment.' :
        msg === 'invalid_code'  ? 'Expired or invalid code. Ask for a new one.' :
        'Connection error. Try again.'
      )
      setPhase('error')
    }
  }

  async function handleSendRequest() {
    if (!lookupToken) return
    setPhase('sending')
    setErrorMsg(null)
    try {
      await sendContactRequest(lookupToken)
      setPhase('sent')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setErrorMsg(
        msg.includes('rate_limited')                                    ? 'Too many requests. Slow down.' :
        msg.includes('already_pending') || msg.includes('duplicate')   ? 'Request already pending.' :
        msg.includes('already_connected')                              ? 'Already connected.' :
        msg.includes('daily_limit')                                    ? 'Daily limit reached. Try again tomorrow.' :
        'Connection error. Try again.'
      )
      setPhase('error')
    }
  }

  function handleBack() {
    setPhase('idle')
    setErrorMsg(null)
    setLookupToken(null)
  }

  const validation = validationMessage()

  return (
    <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-handle" />

        {/* ── Sent state ── */}
        {phase === 'sent' && (
          <>
            <div style={{ textAlign: 'center', padding: 'var(--sp-4) 0 var(--sp-6)' }}>
              <div style={{ marginBottom: 'var(--sp-3)', color: 'var(--accent-light)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div className="sheet-title">Request Sent</div>
              <div className="sheet-sub">Waiting for acceptance.</div>
            </div>
            <button className="auth-btn" onClick={onClose} style={{ marginTop: 0 }}>Done</button>
          </>
        )}

        {/* ── Confirmation state ── */}
        {phase === 'confirming' && (
          <>
            <div className="sheet-title">Send Request?</div>
            <div className="sheet-confirm-box">
              <div className="sheet-confirm-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div className="sheet-confirm-text">Contact found.</div>
              <div className="sheet-confirm-sub">
                Their identity stays private until they accept.
              </div>
            </div>
            <div className="sheet-actions">
              <button className="btn-secondary" onClick={handleBack}>Back</button>
              <button
                className="auth-btn"
                onClick={handleSendRequest}
                style={{ marginTop: 0 }}
              >
                Send Request →
              </button>
            </div>
          </>
        )}

        {/* ── Sending state ── */}
        {phase === 'sending' && (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0' }}>
            <div className="sheet-spinner" />
            <div style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Sending request…</div>
          </div>
        )}

        {/* ── Looking state ── */}
        {phase === 'looking' && (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0' }}>
            <div className="sheet-spinner" />
            <div style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Checking code…</div>
          </div>
        )}

        {/* ── Idle / error state (input) ── */}
        {(phase === 'idle' || phase === 'error') && (
          <>
            <div className="sheet-title">Add Contact</div>
            <div className="sheet-sub">Paste the contact code you received.</div>

            <input
              className={`sheet-input ${isValidFormat ? 'valid' : code.length >= 18 ? 'error' : ''}`}
              type="text"
              placeholder="CXXX-XXXX-XXXX-XXX"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value)
                setPhase('idle')
                setErrorMsg(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && isValidFormat && handleLookup()}
              spellCheck={false}
              autoComplete="off"
              autoFocus
              aria-label="Enter a Cipher contact code"
            />

            {validation && (
              <div className={`sheet-validation-msg ${validation.ok ? 'ok' : 'err'}`} role={validation.ok ? undefined : 'alert'}>
                {validation.text}
              </div>
            )}
            {phase === 'error' && errorMsg && (
              <div className="sheet-validation-msg err" role="alert">{errorMsg}</div>
            )}

            <div className="sheet-actions" style={{ marginTop: 'var(--sp-5)' }}>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="auth-btn"
                onClick={handleLookup}
                disabled={!isValidFormat}
                style={{ marginTop: 0, opacity: !isValidFormat ? 0.45 : 1 }}
              >
                Send Request →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
