import { and, eq, sql, sum } from '@pipecommerce/db'
import {
  customerLoyalty,
  customers,
  loyaltyLedger,
  loyaltyPrograms,
  orders,
} from '@pipecommerce/db/schema'
import { db } from './db.ts'

/**
 * Earn points สำหรับ order ที่จ่ายเงินแล้ว — append-only ledger entry
 *
 * Idempotent: ถ้ามี ledger entry สำหรับ order นี้แล้ว → skip
 *
 * Mirror ของ apps/admin/lib/loyalty.ts:earnLoyaltyForOrder
 * TODO: extract เป็น packages/queries เพื่อไม่ต้อง duplicate
 *
 * เรียกจาก Beam webhook (storefront) + markOrderPaid (admin)
 */
export async function earnLoyaltyForOrder(
  shopId: string,
  orderId: string,
): Promise<void> {
  const [order] = await db
    .select({
      id: orders.id,
      email: orders.email,
      customerId: orders.customerId,
      subtotalPrice: orders.subtotalPrice,
      totalDiscounts: orders.totalDiscounts,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.shopId, shopId)))
    .limit(1)
  if (!order) return

  let customerId = order.customerId
  if (!customerId) {
    if (!order.email) return
    const [c] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.shopId, shopId), eq(customers.email, order.email)))
      .limit(1)
    if (c) {
      customerId = c.id
      await db.update(orders).set({ customerId: c.id }).where(eq(orders.id, orderId))
    } else {
      const [created] = await db
        .insert(customers)
        .values({ shopId, email: order.email })
        .returning({ id: customers.id })
      customerId = created!.id
      await db
        .update(orders)
        .set({ customerId: created!.id })
        .where(eq(orders.id, orderId))
    }
  }

  const [program] = await db
    .select()
    .from(loyaltyPrograms)
    .where(and(eq(loyaltyPrograms.shopId, shopId), eq(loyaltyPrograms.isActive, true)))
    .limit(1)
  if (!program) return

  const [existing] = await db
    .select({ id: loyaltyLedger.id })
    .from(loyaltyLedger)
    .where(
      and(
        eq(loyaltyLedger.referenceType, 'order'),
        eq(loyaltyLedger.referenceId, orderId),
        eq(loyaltyLedger.type, 'earn'),
      ),
    )
    .limit(1)
  if (existing) return

  const subtotal = Number(order.subtotalPrice)
  const discounts = Number(order.totalDiscounts ?? 0)
  const eligible = program.earnExcludesDiscounts
    ? Math.max(0, subtotal - discounts)
    : subtotal
  const points = Math.floor(eligible / Number(program.earnRateAmount))
  if (points <= 0) return

  const [balanceRow] = await db
    .select({ total: sum(loyaltyLedger.points).mapWith(Number) })
    .from(loyaltyLedger)
    .where(eq(loyaltyLedger.customerId, customerId))
  const currentBalance = balanceRow?.total ?? 0
  const balanceAfter = currentBalance + points

  const expiresAt = program.pointsExpiryMonths
    ? new Date(Date.now() + program.pointsExpiryMonths * 30 * 24 * 60 * 60 * 1000)
    : null

  await db.transaction(async (tx) => {
    await tx.insert(loyaltyLedger).values({
      customerId,
      shopId,
      programId: program.id,
      type: 'earn',
      points,
      balanceAfter,
      reason: 'order_paid',
      referenceType: 'order',
      referenceId: orderId,
      expiresAt,
    })

    await tx
      .insert(customerLoyalty)
      .values({
        customerId,
        shopId,
        programId: program.id,
        pointsBalance: balanceAfter,
        pointsLifetime: points,
        lastActivityAt: new Date(),
      })
      .onConflictDoUpdate({
        target: customerLoyalty.customerId,
        set: {
          pointsBalance: balanceAfter,
          pointsLifetime: sql`${customerLoyalty.pointsLifetime} + ${points}`,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        },
      })

    await tx
      .update(orders)
      .set({ loyaltyPointsEarned: points })
      .where(eq(orders.id, orderId))
  })
}
