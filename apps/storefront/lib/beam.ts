/**
 * Beam payment client
 *
 * MVP: stub implementation — ใน dev ไม่ต้องมี API key, ระบบจะ "simulate"
 * payment ที่ /orders/{n}/pay (ลูกค้ากด confirm → mark paid ทันที)
 *
 * Production swap:
 *   1. ตั้ง BEAM_API_KEY + BEAM_WEBHOOK_SECRET ใน .env (per-shop key
 *      จะมาตอน wire vault — ตอนนี้ใช้ shared sandbox)
 *   2. แทน createPaymentLinkStub ด้วย call จริงไปที่
 *      https://api.beamcheckout.com/payment-links (ดู docs.beamcheckout.com)
 *   3. /api/webhooks/beam verify HMAC แล้วอัปเดต order
 *
 * ดู ADR-003 (Beamcheckout marketplace limitations)
 */

export type CreatePaymentLinkInput = {
  amount: number // บาท
  currency: string
  reference: string // order id
  orderNumber: string
  description: string
  returnUrl: string // หลังลูกค้าจ่ายเสร็จ (return ไป /orders/{n}?token=...)
  webhookUrl: string
}

export type CreatePaymentLinkResult = {
  paymentLinkId: string
  url: string
}

const BEAM_API_KEY = process.env.BEAM_API_KEY
const BEAM_API_BASE = process.env.BEAM_API_BASE ?? 'https://api.beamcheckout.com'

export function isBeamConfigured(): boolean {
  return Boolean(BEAM_API_KEY)
}

/**
 * Stub: ในตอนนี้ return URL ของ pay page ใน storefront เอง
 * — pay page จะ simulate การจ่าย (dev mode)
 *
 * Production: replace ด้วย fetch ไป Beam Payment Links API
 */
export async function createPaymentLink(
  input: CreatePaymentLinkInput,
): Promise<CreatePaymentLinkResult> {
  if (!BEAM_API_KEY) {
    // Stub mode — return internal pay URL
    const url = new URL(input.returnUrl).origin
    return {
      paymentLinkId: `stub_${input.reference}`,
      url: `${url}/orders/${input.orderNumber}/pay?token=${new URL(input.returnUrl).searchParams.get('token')}`,
    }
  }

  // TODO: real Beam API call
  // const res = await fetch(`${BEAM_API_BASE}/payment-links`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${BEAM_API_KEY}`,
  //     'Content-Type': 'application/json',
  //     'Idempotency-Key': input.reference,
  //   },
  //   body: JSON.stringify({
  //     amount: input.amount,
  //     currency: input.currency,
  //     reference: input.reference,
  //     description: input.description,
  //     return_url: input.returnUrl,
  //     webhook_url: input.webhookUrl,
  //   }),
  // })
  // if (!res.ok) throw new Error(`Beam create payment link failed: ${res.status}`)
  // const json = await res.json()
  // return { paymentLinkId: json.id, url: json.url }

  throw new Error('Beam real client not implemented yet — set BEAM_API_KEY=stub for dev')
}

/**
 * Verify Beam webhook signature ด้วย HMAC-SHA256
 *
 * Header format ที่รองรับ:
 *   1. plain hex/base64 ของ HMAC-SHA256(rawBody, secret)
 *   2. Stripe-style "t=<unix_ts>,v1=<hex>" — เพิ่ม replay protection 5 นาที
 *      (signature payload = "{ts}.{rawBody}")
 *
 * ใน dev: ถ้าไม่ตั้ง BEAM_WEBHOOK_SECRET → return true (trust all)
 * ใน prod: ต้องตั้ง secret ไม่งั้นจะ reject ทุก request
 */
const REPLAY_WINDOW_SECONDS = 5 * 60

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  const secret = process.env.BEAM_WEBHOOK_SECRET
  if (!secret) {
    // Production ที่ลืมตั้ง secret = อันตราย — reject เลย
    if (process.env.NODE_ENV === 'production') return false
    return true
  }
  if (!signature) return false

  // Parse Stripe-style header if present
  let ts: number | null = null
  let providedSig = signature.trim()
  if (signature.includes('t=') && signature.includes('v1=')) {
    const parts = Object.fromEntries(
      signature.split(',').map((kv) => {
        const [k, v] = kv.split('=', 2)
        return [k!.trim(), v?.trim() ?? '']
      }),
    )
    const tsRaw = parts.t
    const v1 = parts.v1
    if (!tsRaw || !v1) return false
    ts = Number(tsRaw)
    if (!Number.isFinite(ts)) return false
    providedSig = v1
  }

  // Replay protection
  if (ts !== null) {
    const nowSec = Math.floor(Date.now() / 1000)
    if (Math.abs(nowSec - ts) > REPLAY_WINDOW_SECONDS) return false
  }

  const payload = ts !== null ? `${ts}.${rawBody}` : rawBody
  const expected = await computeHmacHex(secret, payload)

  return constantTimeEqual(providedSig.toLowerCase(), expected.toLowerCase())
}

async function computeHmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
  let hex = ''
  for (const b of sigBytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
