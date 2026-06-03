'use client'
import { useState, useRef, useEffect } from 'react'
import { getCodeMetadata, revealCode } from '@/services/contactCodeService'
import type { CodeMetadata } from '@/types/app'

export type RevealPhase = 'masked' | 'entering' | 'revealing' | 'revealed' | 'error'

const REVEAL_SECONDS = 30

export function useContactCode() {
  const [phase, setPhase] = useState<RevealPhase>('masked')
  const [metadata, setMetadata] = useState<CodeMetadata | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(REVEAL_SECONDS)
  // True for 2s after the code rotates while the panel is open — drives pulse animation.
  const [rotated, setRotated] = useState(false)

  const timerRef       = useRef<ReturnType<typeof setInterval>  | null>(null)
  const rotatedFlagRef = useRef<ReturnType<typeof setTimeout>   | null>(null)

  useEffect(() => {
    getCodeMetadata().then(setMetadata).catch(() => {})
  }, [])

  // When metadata loads (or changes), set a timeout to fire exactly when the
  // code expires. If the Settings panel stays open that long, forcibly re-mask
  // and show a brief pulse so the user knows the code rotated.
  useEffect(() => {
    if (!metadata?.expires_at) return
    const ms = new Date(metadata.expires_at).getTime() - Date.now()
    if (ms <= 0) return

    const id = setTimeout(() => {
      // Stop the 30-second reveal countdown if it's running
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

      // Re-mask regardless of current phase — the old code no longer exists
      setPhase('masked')
      setCode(null)
      setPassword('')
      setSecondsLeft(REVEAL_SECONDS)

      // Pulse for 2 seconds to signal the rotation to the user
      if (rotatedFlagRef.current) clearTimeout(rotatedFlagRef.current)
      setRotated(true)
      rotatedFlagRef.current = setTimeout(() => {
        setRotated(false)
        rotatedFlagRef.current = null
      }, 2000)

      // Re-fetch metadata so the new code's expiry is reflected
      getCodeMetadata().then(setMetadata).catch(() => {})
    }, ms)

    return () => clearTimeout(id)
  }, [metadata?.expires_at])

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current)       clearInterval(timerRef.current)
      if (rotatedFlagRef.current) clearTimeout(rotatedFlagRef.current)
    }
  }, [])

  function startCountdown() {
    if (timerRef.current) clearInterval(timerRef.current)
    setSecondsLeft(REVEAL_SECONDS)
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          timerRef.current = null
          setPhase('masked')
          setCode(null)
          setPassword('')
          return REVEAL_SECONDS
        }
        return prev - 1
      })
    }, 1000)
  }

  function beginReveal() {
    setPhase('entering')
    setErrorMsg(null)
    setPassword('')
  }

  function cancelReveal() {
    setPhase('masked')
    setPassword('')
    setErrorMsg(null)
  }

  async function submitReveal() {
    if (!password.trim()) return
    setPhase('revealing')
    setErrorMsg(null)
    try {
      const { code: plaintext } = await revealCode(password)
      setCode(plaintext)
      setPhase('revealed')
      startCountdown()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setErrorMsg(
        msg === 'incorrect_password' ? 'Incorrect password.' :
        msg === 'no_code' ? 'No code yet. Sign out and back in.' :
        'Something went wrong.'
      )
      setPhase('error')
    }
  }

  function relock() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setPhase('masked')
    setCode(null)
    setPassword('')
    setSecondsLeft(REVEAL_SECONDS)
  }

  function copy() {
    if (code) navigator.clipboard.writeText(code).catch(() => {})
  }

  return {
    phase,
    metadata,
    code,
    password,
    setPassword,
    errorMsg,
    secondsLeft,
    rotated,
    beginReveal,
    cancelReveal,
    submitReveal,
    copy,
    relock,
  }
}
