import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { plans } from './plans.ts'
import { shops } from './shops.ts'

/**
 * Shop's subscription to platform plan
 *
 * status: active | past_due | cancelled
 * cancel_at_period_end → ยกเลิกเมื่อจบ billing period (ไม่ใช่ทันที)
 *
 * Monetization model = subscription only ของ ADR-004 — ไม่เก็บ
 * application fee จาก order ของลูกค้า
 */
export const shopSubscriptions = pgTable('shop_subscriptions', {
  id: id(),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  planId: uuid()
    .notNull()
    .references(() => plans.id, { onDelete: 'restrict' }),
  status: text().notNull(),
  currentPeriodStart: timestamp({ withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp({ withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export type ShopSubscription = typeof shopSubscriptions.$inferSelect
export type NewShopSubscription = typeof shopSubscriptions.$inferInsert
