import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { customers } from './customers.ts'
import { shops } from './shops.ts'

/**
 * Order — snapshot ทุกอย่าง ณ เวลาที่สร้าง
 *
 * tracking_token = 32-char random opaque, ใช้ใน public tracking URL
 *   /orders/{order_number}?token={tracking_token}
 *   ดู docs/ARCHITECTURE.md#order-tracking-page-public
 *
 * loyalty_* fields = snapshot ของ earn/redeem (ดู ADR-016 + Phase 2g)
 *
 * tax_lines เก็บใน order_line_items (jsonb per line) ไม่ใช่ที่นี่
 */
export const orders = pgTable(
  'orders',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    orderNumber: text().notNull(), // "1001" ต่อร้าน
    trackingToken: text().notNull().unique(), // 32-char opaque, public tracking
    customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
    email: text(), // guest checkout
    phone: text(),

    // snapshot prices
    currency: text().notNull(),
    subtotalPrice: numeric({ precision: 12, scale: 2 }).notNull(),
    totalDiscounts: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
    totalShipping: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
    totalTax: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
    totalPrice: numeric({ precision: 12, scale: 2 }).notNull(),

    // state machines
    financialStatus: text().notNull(), // pending | paid | partially_refunded | refunded | voided
    fulfillmentStatus: text().notNull(), // unfulfilled | partial | fulfilled
    status: text().notNull(), // open | closed | cancelled

    // snapshot addresses
    shippingAddress: jsonb(),
    billingAddress: jsonb(),

    // loyalty snapshot (Phase 2g, ADR-016)
    loyaltyPointsEarned: integer().notNull().default(0),
    loyaltyPointsRedeemed: integer().notNull().default(0),
    loyaltyAmountRedeemed: numeric({ precision: 12, scale: 2 }).notNull().default('0'),

    cancelReason: text(),
    cancelledAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('orders_shop_number_unique').on(t.shopId, t.orderNumber),
    index('orders_shop_created_idx').on(t.shopId, sql`${t.createdAt} desc`),
    index('orders_shop_financial_status_idx').on(t.shopId, t.financialStatus),
    index('orders_customer_idx').on(t.customerId),
  ],
)

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
