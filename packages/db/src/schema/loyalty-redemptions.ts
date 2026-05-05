import { check, index, integer, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { carts } from './carts.ts'
import { customers } from './customers.ts'
import { loyaltyLedger } from './loyalty-ledger.ts'
import { loyaltyPrograms } from './loyalty-programs.ts'
import { orders } from './orders.ts'
import { shops } from './shops.ts'

/**
 * Redemption ที่ apply ใน cart (status=pending) → finalize ตอน order
 * created (status=applied + ledger_id link). ถ้า cart abandon →
 * status=reversed, ไม่หัก ledger
 *
 * แยกจาก discounts table เพราะ semantics ต่างกัน
 * (balance deduction ไม่ใช่ rule) — ดู ADR-016
 */
export const loyaltyRedemptions = pgTable(
  'loyalty_redemptions',
  {
    id: id(),
    cartId: uuid().references(() => carts.id, { onDelete: 'set null' }),
    orderId: uuid().references(() => orders.id, { onDelete: 'set null' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    programId: uuid()
      .notNull()
      .references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),

    pointsUsed: integer().notNull(),
    amountApplied: numeric({ precision: 12, scale: 2 }).notNull(), // บาท
    ledgerId: uuid().references(() => loyaltyLedger.id, { onDelete: 'set null' }),

    status: text().notNull(), // pending | applied | reversed | refunded
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('loyalty_redemptions_points_positive', sql`${t.pointsUsed} > 0`),
    index('loyalty_redemptions_cart_idx').on(t.cartId),
    index('loyalty_redemptions_order_idx').on(t.orderId),
  ],
)

export type LoyaltyRedemption = typeof loyaltyRedemptions.$inferSelect
export type NewLoyaltyRedemption = typeof loyaltyRedemptions.$inferInsert
