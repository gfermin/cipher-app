import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=self, microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: true,
  // Upload source maps only in CI/production (set SENTRY_AUTH_TOKEN env var)
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Automatically tree-shake Sentry logger statements
  disableLogger: true,
  // Tunnel Sentry requests through our domain to avoid ad-blockers
  tunnelRoute: '/monitoring',
})
