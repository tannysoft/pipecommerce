import * as Sentry from '@sentry/nextjs'

/**
 * Sentry init — รันใน Node.js server runtime ของ Next.js
 *
 * Public DSN ผ่าน NEXT_PUBLIC_SENTRY_DSN (โผล่ทั้ง server + client)
 * No-op ถ้า env ไม่ตั้ง → ในเครื่อง dev / preview ไม่ต้องตั้งก็รันได้
 */
export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      enabled: process.env.NODE_ENV === 'production',
      ignoreErrors: [
        // Auth.js NEXT_REDIRECT ไม่ใช่ error จริง — มันคือ control flow
        'NEXT_REDIRECT',
        'NEXT_NOT_FOUND',
      ],
    })
  }
}

export const onRequestError = Sentry.captureRequestError
