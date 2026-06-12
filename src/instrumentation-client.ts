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
  beforeBreadcrumb(breadcrumb) {
    // Drop HTTP breadcrumbs for the search RPC — request body contains the user's search query
    if (
      breadcrumb.type === 'http' &&
      typeof breadcrumb.data?.url === 'string' &&
      breadcrumb.data.url.includes('search_chat_messages')
    ) {
      return null
    }
    // Drop any breadcrumb whose data contains a raw search query field
    if (breadcrumb.data && typeof breadcrumb.data === 'object') {
      const d = breadcrumb.data as Record<string, unknown>
      if ('p_query' in d || 'chatSearch' in d) return null
    }
    return breadcrumb
  },
  beforeSend(event) {
    // Strip vault-related data from error payloads
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>
      if (data.password || data.vault_token || data.token) {
        return null
      }
    }
    // Scrub search RPC breadcrumbs that may have been captured before the hook ran
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.filter((bc) => {
        if (bc.type === 'http' && typeof bc.data?.url === 'string' && bc.data.url.includes('search_chat_messages')) return false
        return true
      })
    }
    return event
  },
})
