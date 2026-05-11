'use server'

import { and, eq, sql } from '@pipecommerce/db'
import { inventoryItems, orderLineItems, orders } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import {
  sendCancellationNotice,
  sendFulfillmentNotice,
  sendRefundNotice,
} from '@/lib/email.ts'
import { earnLoyaltyForOrder } from '@/lib/loyalty.ts'
import { requireShop } from '@/lib/shop.ts'
import { shopOrderTrackingUrl } from '@/lib/storefront-url.ts'

export type ActionResult = { ok: true } | { ok: false; error: string }

async function loadOrder(shopSlug: string, orderId: string) {
  const { shop } = await requireShop(shopSlug)
  const [row] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      trackingToken: orders.trackingToken,
      email: orders.email,
      totalPrice: orders.totalPrice,
      financialStatus: orders.financialStatus,
      fulfillmentStatus: orders.fulfillmentStatus,
      status: orders.status,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.shopId, shop.id)))
    .limit(1)
  return { shop, order: row }
}

export async function markOrderPaid(
  shopSlug: string,
  orderId: string,
): Promise<ActionResult> {
  const { shop, order } = await loadOrder(shopSlug, orderId)
  if (!order) return { ok: false, error: 'ไม่พบ order' }
  if (order.financialStatus === 'paid') return { ok: false, error: 'จ่ายแล้ว' }
  if (order.status === 'cancelled') return { ok: false, error: 'order ถูกยกเลิก' }

  await db
    .update(orders)
    .set({ financialStatus: 'paid', updatedAt: new Date() })
    .where(eq(orders.id, orderId))

  // Earn loyalty points (idempotent — best-effort)
  try {
    await earnLoyaltyForOrder(shop.id, orderId)
  } catch (error) {
    console.error('[orders] loyalty earn failed', error)
  }

  revalidatePath(`/${shopSlug}/orders/${orderId}`)
  revalidatePath(`/${shopSlug}/orders`)
  return { ok: true }
}

export async function markOrderFulfilled(
  shopSlug: string,
  orderId: string,
): Promise<ActionResult> {
  const { shop, order } = await loadOrder(shopSlug, orderId)
  if (!order) return { ok: false, error: 'ไม่พบ order' }
  if (order.fulfillmentStatus === 'fulfilled') return { ok: false, error: 'ส่งของแล้ว' }
  if (order.status === 'cancelled') return { ok: false, error: 'order ถูกยกเลิก' }

  await db
    .update(orders)
    .set({ fulfillmentStatus: 'fulfilled', updatedAt: new Date() })
    .where(eq(orders.id, orderId))

  if (order.email) {
    try {
      await sendFulfillmentNotice({
        to: order.email,
        shop: { name: shop.name, currency: shop.currency },
        order: { orderNumber: order.orderNumber, totalPrice: order.totalPrice },
        trackingUrl: shopOrderTrackingUrl(shop.slug, order.orderNumber, order.trackingToken),
      })
    } catch (error) {
      console.error('[orders] fulfillment email failed', error)
    }
  }

  revalidatePath(`/${shopSlug}/orders/${orderId}`)
  revalidatePath(`/${shopSlug}/orders`)
  return { ok: true }
}

export async function closeOrder(
  shopSlug: string,
  orderId: string,
): Promise<ActionResult> {
  const { order } = await loadOrder(shopSlug, orderId)
  if (!order) return { ok: false, error: 'ไม่พบ order' }
  if (order.status === 'closed') return { ok: false, error: 'ปิดแล้ว' }
  if (order.status === 'cancelled') return { ok: false, error: 'order ถูกยกเลิก' }

  const now = new Date()
  await db
    .update(orders)
    .set({ status: 'closed', closedAt: now, updatedAt: now })
    .where(eq(orders.id, orderId))

  revalidatePath(`/${shopSlug}/orders/${orderId}`)
  revalidatePath(`/${shopSlug}/orders`)
  return { ok: true }
}

export async function reopenOrder(
  shopSlug: string,
  orderId: string,
): Promise<ActionResult> {
  const { order } = await loadOrder(shopSlug, orderId)
  if (!order) return { ok: false, error: 'ไม่พบ order' }
  if (order.status !== 'closed') return { ok: false, error: 'order ไม่ได้ปิดอยู่' }

  await db
    .update(orders)
    .set({ status: 'open', closedAt: null, updatedAt: new Date() })
    .where(eq(orders.id, orderId))

  revalidatePath(`/${shopSlug}/orders/${orderId}`)
  revalidatePath(`/${shopSlug}/orders`)
  return { ok: true }
}

export async function refundOrder(
  shopSlug: string,
  orderId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      trackingToken: orders.trackingToken,
      email: orders.email,
      currency: orders.currency,
      totalPrice: orders.totalPrice,
      financialStatus: orders.financialStatus,
      status: orders.status,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.shopId, shop.id)))
    .limit(1)
  if (!order) return { ok: false, error: 'ไม่พบ order' }
  if (order.financialStatus !== 'paid' && order.financialStatus !== 'partially_refunded') {
    return { ok: false, error: 'order ยังไม่ได้จ่ายเงิน — refund ไม่ได้' }
  }

  const amountRaw = String(formData.get('amount') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim() || null
  const amount = Number(amountRaw)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'จำนวนเงินไม่ถูกต้อง' }
  }
  const total = Number(order.totalPrice)
  if (amount > total) {
    return { ok: false, error: `จำนวนเกินยอดทั้งหมด (${order.currency} ${total})` }
  }
  const isPartial = amount < total

  await db
    .update(orders)
    .set({
      financialStatus: isPartial ? 'partially_refunded' : 'refunded',
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))

  if (order.email) {
    try {
      await sendRefundNotice({
        to: order.email,
        shop: { name: shop.name, currency: shop.currency },
        order: { orderNumber: order.orderNumber, totalPrice: order.totalPrice },
        amount,
        isPartial,
        reason,
        trackingUrl: shopOrderTrackingUrl(shop.slug, order.orderNumber, order.trackingToken),
      })
    } catch (error) {
      console.error('[orders] refund email failed', error)
    }
  }

  revalidatePath(`/${shopSlug}/orders/${orderId}`)
  revalidatePath(`/${shopSlug}/orders`)
  return { ok: true }
}

export async function cancelOrder(
  shopSlug: string,
  orderId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop, order } = await loadOrder(shopSlug, orderId)
  if (!order) return { ok: false, error: 'ไม่พบ order' }
  if (order.status === 'cancelled') return { ok: false, error: 'ยกเลิกแล้ว' }

  const reason = String(formData.get('reason') ?? '').trim() || null
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))

    // Restock — refund inventory ของทุก line item (เฉพาะ variant ที่ track stock)
    const lines = await tx
      .select({ variantId: orderLineItems.variantId, quantity: orderLineItems.quantity })
      .from(orderLineItems)
      .where(eq(orderLineItems.orderId, orderId))

    for (const line of lines) {
      if (!line.variantId) continue
      await tx
        .update(inventoryItems)
        .set({ available: sql`${inventoryItems.available} + ${line.quantity}` })
        .where(eq(inventoryItems.variantId, line.variantId))
    }
  })

  if (order.email) {
    try {
      await sendCancellationNotice({
        to: order.email,
        shop: { name: shop.name, currency: shop.currency },
        order: { orderNumber: order.orderNumber, totalPrice: order.totalPrice },
        reason,
        trackingUrl: shopOrderTrackingUrl(shop.slug, order.orderNumber, order.trackingToken),
      })
    } catch (error) {
      console.error('[orders] cancellation email failed', error)
    }
  }

  revalidatePath(`/${shopSlug}/orders/${orderId}`)
  revalidatePath(`/${shopSlug}/orders`)
  return { ok: true }
}
