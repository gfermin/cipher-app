'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

export function RegisterForm() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!username.trim()) { setError('Username is required'); return }
    if (username.length < 3) { setError('Username must be at least 3 characters'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Username can only contain letters, numbers, and underscores'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      const authUser = await signUp(username.trim(), password)
      if (authUser) {
        // Session was created immediately (email confirmation disabled).
        // Populate the auth store now so AppLayout renders the app on the
        // very first navigation — no redirect loop, no "loads forever".
        setUser(authUser)
        router.push('/chats')
      } else {
        // Email confirmation required — user must verify before logging in.
        router.push('/login?registered=1')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-logo">
        <div className="auth-logo-icon">🔐</div>
        <div className="auth-title">Create Account</div>
        <div className="auth-subtitle">Join Cipher.</div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label">Username</label>
          <input
            className="auth-input"
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">Password</label>
          <input
            className="auth-input"
            type="password"
            placeholder="8+ characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">Confirm Password</label>
          <input
            className="auth-input"
            type="password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <button
          className={`auth-btn${loading ? ' auth-btn--loading' : ''}`}
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="btn-spinner" />
              Creating account…
            </>
          ) : 'Create Account'}
        </button>
      </form>

      <div className="auth-link">
        Already have an account?{' '}
        <Link href="/login">Sign In</Link>
      </div>
    </div>
  )
}
