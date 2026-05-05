import { integer, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { fulfillments } from './fulfillments.ts'
import { orderLineItems } from './order-line-items.ts'

/**
 * Junction: line item ของ order ไหน อยู่ใน fulfillment ไหน + จำนวน
 * (รองรับ partial fulfillment + split shipment)
 */
export const fulfillmentLineItems = pgTable(
  'fulfillment_line_items',
  {
    fulfillmentId: uuid()
      .notNull()
      .references(() => fulfillments.id, { onDelete: 'cascade' }),
    lineItemId: uuid()
      .notNull()
      .references(() => orderLineItems.id, { onDelete: 'cascade' }),
    quantity: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.fulfillmentId, t.lineItemId] })],
)

export type FulfillmentLineItem = typeof fulfillmentLineItems.$inferSelect
export type NewFulfillmentLineItem = typeof fulfillmentLineItems.$inferInsert
