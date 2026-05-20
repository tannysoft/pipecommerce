import { describe, expect, it, beforeEach } from 'vitest'
import { verifyWebhookSignature } from './beam.ts'

/**
 * Test cases สำหรับ HMAC signature verification
 * Run: pnpm --filter @pipecommerce/storefront test
 */

const SECRET = 'test-secret-12345'

async function computeHmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
  let hex = ''
  for (const b of sig) hex += b.toString(16).padStart(2, '0')
  return hex
}

describe('verifyWebhookSignature', () => {
  beforeEach(() => {
    process.env.BEAM_WEBHOOK_SECRET = SECRET
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
  })

  it('accepts plain hex signature when correct', async () => {
    const body = '{"event":"ping"}'
    const sig = await computeHmac(SECRET, body)
    expect(await verifyWebhookSignature(body, sig)).toBe(true)
  })

  it('rejects plain hex signature when wrong', async () => {
    expect(await verifyWebhookSignature('{}', 'deadbeef')).toBe(false)
  })

  it('accepts Stripe-style t=...,v1=... format', async () => {
    const body = '{"event":"x"}'
    const ts = Math.floor(Date.now() / 1000)
    const sig = await computeHmac(SECRET, `${ts}.${body}`)
    const header = `t=${ts},v1=${sig}`
    expect(await verifyWebhookSignature(body, header)).toBe(true)
  })

  it('rejects Stripe-style with stale timestamp (>5 min)', async () => {
    const body = '{}'
    const ts = Math.floor(Date.now() / 1000) - 600 // 10 min ago
    const sig = await computeHmac(SECRET, `${ts}.${body}`)
    expect(await verifyWebhookSignature(body, `t=${ts},v1=${sig}`)).toBe(false)
  })

  it('rejects missing signature header', async () => {
    expect(await verifyWebhookSignature('{}', null)).toBe(false)
  })

  it('uses constant-time compare (length mismatch returns false)', async () => {
    expect(await verifyWebhookSignature('{}', 'short')).toBe(false)
  })
})
