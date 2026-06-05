import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'AbortError',
    /^NetworkError/,
  ],
  beforeSend(event) {
    // Strip any vault-related data from error payloads to avoid leaking sensitive context
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>
      if (data.password || data.vault_token || data.token) {
        return null
      }
    }
    return event
  },
})
