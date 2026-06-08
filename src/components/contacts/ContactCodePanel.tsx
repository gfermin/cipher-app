'use client'
import { useContactCode } from '@/hooks/useContactCode'

export function ContactCodePanel() {
  const {
    phase,
    metadata,
    code,
    password,
    setPassword,
    errorMsg,
    secondsLeft,
    rotated,
    copied,
    beginReveal,
    cancelReveal,
    submitReveal,
    copy,
    relock,
  } = useContactCode()

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') submitReveal()
    if (e.key === 'Escape') cancelReveal()
  }

  // Split code into segments: CXXX-XXXX-XXXX-XXX
  function codeSegments(raw: string) {
    return [raw.slice(0, 4), raw.slice(5, 9), raw.slice(10, 14), raw.slice(15)]
  }

  // Render masked segment as individual Cipher-style dots
  function maskedDots(count: number) {
    return Array.from({ length: count }, (_, i) => (
      <span key={i} className="code-dot" />
    ))
  }

  const isLow = secondsLeft <= 10

  return (
    <div className="code-display-card">
      <div className="code-label">Your Contact Code</div>

      {/* ── Masked / revealed display ── */}
      <div
        className={`code-segments${rotated ? ' code-rotated' : ''}`}
        role="region"
        aria-label={phase === 'revealed' && code ? 'Your contact code, revealed' : 'Your contact code, hidden'}
        aria-live="polite"
      >
        {phase === 'revealed' && code ? (
          codeSegments(code).map((seg, i) => (
            <span key={i}>
              {i > 0 && <span className="code-separator"> </span>}
              <span
                className="code-segment-revealed"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {seg}
              </span>
            </span>
          ))
        ) : (
          <>
            <span className="code-segment-masked">{maskedDots(4)}</span>
            <span className="code-segment-masked">{maskedDots(4)}</span>
            <span className="code-segment-masked">{maskedDots(4)}</span>
            <span className="code-segment-masked">{maskedDots(3)}</span>
          </>
        )}
      </div>

      {/* ── Timer bar (revealed phase only) ── */}
      {phase === 'revealed' && (
        <div className="code-timer-bar">
          <div
            className={`code-timer-fill${isLow ? ' code-timer-fill-low' : ''}`}
            style={{ width: `${(secondsLeft / 30) * 100}%`, transition: 'width 1s linear' }}
          />
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)' }}>

        {phase === 'masked' && (
          <button className="code-reveal-btn" onClick={beginReveal}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Reveal with Password
          </button>
        )}

        {(phase === 'entering' || phase === 'error') && (
          <div className="code-password-form">
            <input
              className="code-password-input"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              aria-label="Enter your password to reveal the contact code"
            />
            <button
              className="code-reveal-btn"
              onClick={submitReveal}
              disabled={!password.trim()}
              style={{ opacity: !password.trim() ? 0.5 : 1, pointerEvents: !password.trim() ? 'none' : 'auto' }}
            >
              Reveal
            </button>
            <button
              className="btn-secondary"
              onClick={cancelReveal}
              style={{ padding: 'var(--sp-2) var(--sp-3)' }}
            >
              Cancel
            </button>
          </div>
        )}

        {phase === 'revealing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <div className="sheet-spinner" style={{ width: 20, height: 20 }} />
            <div style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }} aria-live="polite" aria-busy="true">
              Verifying…
            </div>
          </div>
        )}

        {phase === 'revealed' && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <button className={`code-copy-btn${copied ? ' code-copy-btn--copied' : ''}`} onClick={copy} aria-label={copied ? 'Copied!' : 'Copy contact code'}>
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="btn-secondary" onClick={relock} style={{ padding: 'var(--sp-2) var(--sp-3)', fontSize: 'var(--text-sm)' }}>
              Hide
            </button>
          </div>
        )}

        {(phase === 'error' && errorMsg) && (
          <div className="code-error-msg" role="alert">{errorMsg}</div>
        )}

        {phase === 'revealed' && (
          <div className={`code-refresh-hint${isLow ? ' code-refresh-hint-low' : ''}`}>
            Auto-locks in {secondsLeft}s · Refreshes daily
          </div>
        )}

        {phase === 'masked' && metadata?.expires_at && (
          <div className="code-refresh-hint">
            {rotated ? 'Code refreshed.' : 'Refreshes daily'}
          </div>
        )}

        {!metadata?.has_code && phase === 'masked' && (
          <div className="code-refresh-hint">No code yet. Sign out and back in.</div>
        )}
      </div>
    </div>
  )
}
