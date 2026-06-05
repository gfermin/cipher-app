import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Capture 100% of sessions in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Capture replays only on errors in production
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  // Ignore common non-actionable errors
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
