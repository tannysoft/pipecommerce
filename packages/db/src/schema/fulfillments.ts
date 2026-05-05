import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { orders } from './orders.ts'
import { shops } from './shops.ts'

/**
 * Fulfillment = การส่งของ 1 ครั้ง (1 order มีได้หลาย fulfillment ถ้าแยกส่ง)
 *
 * line items ที่อยู่ใน fulfillment นี้ → ดู fulfillment_line_items
 */
export const fulfillments = pgTable('fulfillments', {
  id: id(),
  orderId: uuid()
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  status: text().notNull(), // pending | shipped | delivered | failed | cancelled
  trackingCompany: text(), // Kerry, Flash, EMS, ...
  trackingNumber: text(),
  trackingUrl: text(),
  shippedAt: timestamp({ withTimezone: true }),
  deliveredAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export type Fulfillment = typeof fulfillments.$inferSelect
export type NewFulfillment = typeof fulfillments.$inferInsert
