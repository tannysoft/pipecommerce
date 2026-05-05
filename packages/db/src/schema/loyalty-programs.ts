import { sql } from 'drizzle-orm'
import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Loyalty program — 1 active per shop (partial unique index)
 *
 * Earn formula: floor(eligible_amount / earn_rate_amount) = points
 *   eligible_amount = subtotal (ถ้า earn_on_subtotal)
 *                     - discounts (ถ้า earn_excludes_discounts)
 *
 * Redeem: customer_pays - (points_used × redeem_value_per_point)
 *   constraints: points >= redeem_min_points, in steps of redeem_step,
 *                amount <= cart_total × redeem_max_pct_of_order
 *
 * ดู ADR-016 + docs/ARCHITECTURE.md#crm--loyalty
 */
export const loyaltyPrograms = pgTable(
  'loyalty_programs',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    isActive: boolean().notNull().default(true),

    // earn config
    earnRateAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    earnOnSubtotal: boolean().notNull().default(true),
    earnExcludesDiscounts: boolean().notNull().default(true),
    signupBonusPoints: integer().notNull().default(0),

    // redeem config
    redeemMinPoints: integer().notNull().default(100),
    redeemValuePerPoint: numeric({ precision: 12, scale: 4 }).notNull(),
    redeemStep: integer().notNull().default(1),
    redeemMaxPctOfOrder: numeric({ precision: 5, scale: 2 }),

    // expiry
    pointsExpiryMonths: integer(), // NULL = ไม่หมดอายุ
    expiryWarningDays: integer().notNull().default(30),

    termsUrl: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('loyalty_programs_shop_name_unique').on(t.shopId, t.name),
    uniqueIndex('loyalty_programs_shop_active_unique')
      .on(t.shopId)
      .where(sql`${t.isActive} = true`),
  ],
)

export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect
export type NewLoyaltyProgram = typeof loyaltyPrograms.$inferInsert
