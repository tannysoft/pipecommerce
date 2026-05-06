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
 * Verify webhook signature ด้วย HMAC-SHA256
 * (Beam ส่ง X-Beam-Signature header)
 *
 * Stub: ไม่ verify ใน dev — production จะใช้ Web Crypto API ของ Workers/Node
 */
export async function verifyWebhookSignature(
  _rawBody: string,
  _signature: string | null,
): Promise<boolean> {
  if (!process.env.BEAM_WEBHOOK_SECRET) return true // dev: trust all
  // TODO: implement HMAC verify
  return true
}
