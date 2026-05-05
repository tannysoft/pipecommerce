import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id } from './_helpers.ts'
import { customers } from './customers.ts'
import { discounts } from './discounts.ts'
import { orders } from './orders.ts'
import { shops } from './shops.ts'

/**
 * 1 row per (discount, order) — ใช้เช็ค usage_limit + usage_limit_per_customer
 */
export const discountUsages = pgTable(
  'discount_usages',
  {
    id: id(),
    discountId: uuid()
      .notNull()
      .references(() => discounts.id, { onDelete: 'cascade' }),
    customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    usedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('discount_usages_discount_customer_idx').on(t.discountId, t.customerId)],
)

export type DiscountUsage = typeof discountUsages.$inferSelect
export type NewDiscountUsage = typeof discountUsages.$inferInsert
