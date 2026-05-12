'use server'

import { and, eq } from '@pipecommerce/db'
import { orders, payments } from '@pipecommerce/db/schema'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { sendPaymentReceipt } from '@/lib/email.ts'
import { buildAbsoluteUrl, requireShopFromHost } from '@/lib/shop.ts'

/**
 * Stub-mode payment simulator — สำหรับ dev เท่านั้น
 *
 * Production: real flow คือ Beam ส่ง webhook ไปที่ /api/webhooks/beam
 * แล้ว webhook handler update order. หน้า pay ไม่ควรมี action นี้
 */
export async function simulatePayment(
  orderId: string,
  trackingToken: string,
): Promise<void> {
  if (process.env.BEAM_API_KEY) {
    // Production with Beam configured — ไม่ควรมาที่ action นี้
    throw new Error('Cannot simulate when BEAM_API_KEY is set')
  }

  const shop = await requireShopFromHost()

  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      email: orders.email,
      totalPrice: orders.totalPrice,
      subtotalPrice: orders.subtotalPrice,
      totalShipping: orders.totalShipping,
      totalTax: orders.totalTax,
      totalDiscounts: orders.totalDiscounts,
      currentStatus: orders.financialStatus,
    })
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.shopId, shop.id),
        eq(orders.trackingToken, trackingToken),
      ),
    )
    .limit(1)

  if (!order) return
  if (order.currentStatus === 'paid') {
    redirect(`/orders/${order.orderNumber}?token=${trackingToken}`)
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ financialStatus: 'paid', updatedAt: new Date() })
      .where(eq(orders.id, orderId))

    await tx.insert(payments).values({
      orderId,
      shopId: shop.id,
      provider: 'beam-stub',
      amount: order.totalPrice,
      status: 'succeeded',
      paymentMethod: 'simulated',
      paidAt: new Date(),
    })
  })

  // Receipt email — fire-and-forget
  if (order.email) {
    try {
      const trackingUrl = await buildAbsoluteUrl(
        `/orders/${order.orderNumber}?token=${trackingToken}`,
      )
      await sendPaymentReceipt({
        to: order.email,
        shop: { name: shop.name, currency: shop.currency },
        order: {
          orderNumber: order.orderNumber,
          subtotalPrice: order.subtotalPrice,
          totalDiscounts: order.totalDiscounts,
          totalShipping: order.totalShipping,
          totalTax: order.totalTax,
          totalPrice: order.totalPrice,
        },
        trackingUrl,
      })
    } catch (error) {
      console.error('[pay] receipt email failed', error)
    }
  }

  redirect(`/orders/${order.orderNumber}?token=${trackingToken}`)
}
