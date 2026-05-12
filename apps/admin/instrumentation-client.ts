import * as Sentry from '@sentry/nextjs'

/**
 * Sentry client-side init — รันใน browser
 * No-op ถ้า env ไม่ตั้ง
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.05,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    enabled: process.env.NODE_ENV === 'production',
    integrations: [
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
  })
}

