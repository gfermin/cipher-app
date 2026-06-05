'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', fontFamily: 'system-ui, sans-serif' }}>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>Something went wrong.</p>
          <button
            onClick={reset}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#333', color: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
