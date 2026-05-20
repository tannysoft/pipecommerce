import { eq } from '@pipecommerce/db'
import { orders, payments } from '@pipecommerce/db/schema'
import { NextResponse, type NextRequest } from 'next/server'
import { verifyWebhookSignature } from '@/lib/beam.ts'
import { db } from '@/lib/db.ts'
import { earnLoyaltyForOrder } from '@/lib/loyalty.ts'

/**
 * Beam webhook receiver
 *
 * Production: Beam ส่ง POST มาเมื่อมี payment event (succeeded, failed, refunded)
 * → verify HMAC signature → update order
 *
 * MVP: stub — verifyWebhookSignature คืน true เสมอ ถ้าไม่ตั้ง
 *      BEAM_WEBHOOK_SECRET. real flow จะมาเมื่อ swap Beam client เป็นตัวจริง
 *
 * ดู ADR-003 + docs/ARCHITECTURE.md#payment-architecture-beamcheckout
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-beam-signature')

  const valid = await verifyWebhookSignature(rawBody, signature)
  if (!valid) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let event: { type: string; data: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Beam event types — adjust ตาม spec จริงเมื่อมี
  switch (event.type) {
    case 'payment.succeeded': {
      const reference = event.data.reference as string | undefined
      const chargeId = event.data.id as string | undefined
      const amount = event.data.amount as number | undefined
      if (!reference) break

      await db.transaction(async (tx) => {
        const [order] = await tx
          .select({ id: orders.id, shopId: orders.shopId, totalPrice: orders.totalPrice })
          .from(orders)
          .where(eq(orders.id, reference))
          .limit(1)
        if (!order) return

        await tx
          .update(orders)
          .set({ financialStatus: 'paid', updatedAt: new Date() })
          .where(eq(orders.id, order.id))

        await tx.insert(payments).values({
          orderId: order.id,
          shopId: order.shopId,
          provider: 'beam',
          providerChargeId: chargeId,
          amount: String(amount ?? order.totalPrice),
          status: 'succeeded',
          paidAt: new Date(),
          rawResponse: event.data,
        })
      })

      // Loyalty earn — outside the payment transaction (idempotent, won't
      // double-credit on webhook retry). Best-effort; don't block ack.
      try {
        const [paid] = await db
          .select({ id: orders.id, shopId: orders.shopId })
          .from(orders)
          .where(eq(orders.id, reference))
          .limit(1)
        if (paid) await earnLoyaltyForOrder(paid.shopId, paid.id)
      } catch (err) {
        console.error('[beam-webhook] loyalty earn failed:', err)
      }
      break
    }
    case 'payment.failed': {
      const reference = event.data.reference as string | undefined
      const reason = event.data.failure_reason as string | undefined
      if (!reference) break

      const [order] = await db
        .select({ id: orders.id, shopId: orders.shopId, totalPrice: orders.totalPrice })
        .from(orders)
        .where(eq(orders.id, reference))
        .limit(1)
      if (!order) break

      await db.insert(payments).values({
        orderId: order.id,
        shopId: order.shopId,
        provider: 'beam',
        amount: order.totalPrice,
        status: 'failed',
        failureReason: reason,
        rawResponse: event.data,
      })
      break
    }
    // payment.refunded ทำใน phase ถัดไป
  }

  return NextResponse.json({ ok: true })
}
