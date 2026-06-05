'use client'
import { useState, useEffect, useRef } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { hasUserVaultCode, setUserVaultCode } from '@/services/vaultService'

const PIN_LEN = 6

type Phase = 'loading' | 'enter' | 'confirm' | 'saving' | 'success'

interface PinRowProps {
  digits: string[]
  refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  disabled?: boolean
  label: string
  shake?: boolean
  onChange: (idx: number, value: string) => void
  onKeyDown: (e: React.KeyboardEvent, idx: number) => void
  onPaste: (e: React.ClipboardEvent) => void
}

function PinRow({ digits, refs, disabled, label, shake, onChange, onKeyDown, onPaste }: PinRowProps) {
  return (
    <div className="vault-pin-group">
      <div className="vault-pin-label">{label}</div>
      <div className={`vault-pin-row${shake ? ' vault-pin-row--shake' : ''}`}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el }}
            className={`vault-pin-box${disabled ? ' vault-pin-box--done' : ''}`}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onPaste={onPaste}
            aria-label={`${label} digit ${i + 1} of ${PIN_LEN}`}
            disabled={disabled}
            autoComplete="off"
          />
        ))}
      </div>
    </div>
  )
}

interface Props {
  chatId: string
  onClose: () => void
}

export function VaultSetupModal({ chatId, onClose }: Props) {
  const { showToast } = useUIStore()
  const [isUpdate, setIsUpdate] = useState(false)
  const [phase, setPhase] = useState<Phase>('loading')
  const [enterDigits, setEnterDigits] = useState<string[]>(Array(PIN_LEN).fill(''))
  const [confirmDigits, setConfirmDigits] = useState<string[]>(Array(PIN_LEN).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const enterRefs = useRef<(HTMLInputElement | null)[]>([])
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([])
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    hasUserVaultCode(chatId)
      .then((exists) => { setIsUpdate(exists); setPhase('enter') })
      .catch(() => { setIsUpdate(false); setPhase('enter') })
  }, [chatId])

  useEffect(() => {
    if (phase === 'enter') {
      const t = setTimeout(() => enterRefs.current[0]?.focus(), 60)
      return () => clearTimeout(t)
    }
    if (phase === 'confirm') {
      const t = setTimeout(() => confirmRefs.current[0]?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [phase])

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

  function digitChange(
    idx: number,
    rawValue: string,
    digits: string[],
    setDigits: (d: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    onFull: (code: string) => void
  ) {
    const digit = rawValue.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = digit
    setDigits(next)
    if (digit && idx < PIN_LEN - 1) refs.current[idx + 1]?.focus()
    if (next.every(d => d !== '')) onFull(next.join(''))
  }

  function digitKeyDown(
    e: React.KeyboardEvent,
    idx: number,
    digits: string[],
    setDigits: (d: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits]; next[idx] = ''; setDigits(next)
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus()
      }
    }
  }

  function doPaste(
    e: React.ClipboardEvent,
    setDigits: (d: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    onFull: (code: string) => void
  ) {
    e.preventDefault()
    const raw = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LEN)
    const next = Array(PIN_LEN).fill('')
    for (let i = 0; i < raw.length; i++) next[i] = raw[i]
    setDigits(next)
    refs.current[Math.min(raw.length, PIN_LEN - 1)]?.focus()
    if (raw.length === PIN_LEN) onFull(raw)
  }

  function onEnterFull() {
    setError(null)
    setPhase('confirm')
  }

  async function onConfirmFull(confirmCode: string) {
    const entered = enterDigits.join('')
    if (entered !== confirmCode) {
      setError("Codes don't match. Try again.")
      setEnterDigits(Array(PIN_LEN).fill(''))
      setConfirmDigits(Array(PIN_LEN).fill(''))
      setPhase('enter')
      triggerShake()
      return
    }
    setPhase('saving')
    try {
      await setUserVaultCode(chatId, entered)
      setPhase('success')
      showToast(isUpdate ? 'Vault code updated' : 'Vault code set', 'success')
      setTimeout(onClose, 700)
    } catch {
      setError('Something went wrong. Try again.')
      setEnterDigits(Array(PIN_LEN).fill(''))
      setConfirmDigits(Array(PIN_LEN).fill(''))
      setPhase('enter')
      triggerShake()
    }
  }

  const enterFull = enterDigits.every(d => d !== '')
  const confirmFull = confirmDigits.every(d => d !== '')

  return (
    <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Set vault code" ref={sheetRef}>
        <div className="sheet-handle" />

        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0' }}>
            <div className="sheet-spinner" />
          </div>
        )}

        {phase !== 'loading' && phase !== 'success' && (
          <>
            <div className="sheet-title">
              {isUpdate ? 'Update vault code' : 'Set vault code'}
            </div>
            <div className="sheet-sub">
              {phase === 'confirm'
                ? 'Confirm your code.'
                : isUpdate
                  ? 'Enter a new 6-digit code.'
                  : 'Choose a 6-digit code for your vault.'}
            </div>

            {error && (
              <div className="sheet-validation-msg err" role="alert" style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
                {error}
              </div>
            )}

            <PinRow
              digits={enterDigits}
              refs={enterRefs}
              disabled={phase === 'confirm' || phase === 'saving'}
              label={phase === 'confirm' ? 'Code' : 'Enter code'}
              shake={shaking}
              onChange={(i, v) => digitChange(i, v, enterDigits, setEnterDigits, enterRefs, onEnterFull)}
              onKeyDown={(e, i) => digitKeyDown(e, i, enterDigits, setEnterDigits, enterRefs)}
              onPaste={(e) => doPaste(e, setEnterDigits, enterRefs, onEnterFull)}
            />

            {(phase === 'confirm' || phase === 'saving') && (
              <div className="vault-pin-confirm-row">
                <PinRow
                  digits={confirmDigits}
                  refs={confirmRefs}
                  disabled={phase === 'saving'}
                  label="Confirm"
                  onChange={(i, v) => digitChange(i, v, confirmDigits, setConfirmDigits, confirmRefs, onConfirmFull)}
                  onKeyDown={(e, i) => digitKeyDown(e, i, confirmDigits, setConfirmDigits, confirmRefs)}
                  onPaste={(e) => doPaste(e, setConfirmDigits, confirmRefs, onConfirmFull)}
                />
              </div>
            )}

            <div className="sheet-actions" style={{ marginTop: 'var(--sp-5)' }}>
              <button className="btn-secondary" onClick={onClose} disabled={phase === 'saving'}>
                Cancel
              </button>
              {phase === 'enter' ? (
                <button
                  className="auth-btn"
                  onClick={onEnterFull}
                  disabled={!enterFull}
                  style={{ marginTop: 0, opacity: !enterFull ? 0.45 : 1 }}
                >
                  Next →
                </button>
              ) : (
                <button
                  className="auth-btn"
                  onClick={() => onConfirmFull(confirmDigits.join(''))}
                  disabled={!confirmFull || phase === 'saving'}
                  style={{ marginTop: 0, opacity: !confirmFull ? 0.45 : 1 }}
                >
                  {phase === 'saving' ? 'Saving…' : 'Save →'}
                </button>
              )}
            </div>
          </>
        )}

        {phase === 'success' && (
          <div style={{ textAlign: 'center', padding: 'var(--sp-6) 0' }}>
            <div className="vault-success-icon" style={{ marginBottom: 'var(--sp-3)', color: 'var(--vault-accent)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="sheet-title" style={{ color: 'var(--vault-accent)' }}>
              Vault code {isUpdate ? 'updated' : 'set'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
