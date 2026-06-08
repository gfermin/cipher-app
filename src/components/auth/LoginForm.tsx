'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

export function LoginForm() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setError('')
    setLoading(true)

    try {
      const user = await signIn(username.trim(), password)
      setUser(user)
      router.push('/chats')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-logo">
        <div className="auth-logo-icon">🔐</div>
        <div className="auth-title">Cipher</div>
        <div className="auth-subtitle">Private conversations, protected.</div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label">Username</label>
          <input
            className="auth-input"
            type="text"
            placeholder="Enter your username"
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
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
              Signing in…
            </>
          ) : 'Sign In'}
        </button>
      </form>

      <div className="auth-link">
        No account?{' '}
        <Link href="/register">Create one</Link>
      </div>
    </div>
  )
}
