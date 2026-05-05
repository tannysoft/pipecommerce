import { boolean, integer, jsonb, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { id } from './_helpers.ts'
import { orders } from './orders.ts'
import { productVariants } from './product-variants.ts'
import { shops } from './shops.ts'

/**
 * Order line item — snapshot ราคา + product info ตอนสร้าง order
 *
 * variant_id nullable เผื่อ variant ถูกลบ (ON DELETE SET NULL)
 *   — ข้อมูลใน snapshot ยังอยู่ครบ
 * tax_lines = jsonb array ของ tax breakdown ต่อ line
 *   [{ rate, name, amount, mode, absorbed_by_shop }]
 *   ดู docs/ARCHITECTURE.md#tax-calculation
 */
export const orderLineItems = pgTable('order_line_items', {
  id: id(),
  orderId: uuid()
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  variantId: uuid().references(() => productVariants.id, { onDelete: 'set null' }),

  // snapshot
  productTitle: text().notNull(),
  variantTitle: text(),
  sku: text(),
  quantity: integer().notNull(),
  price: numeric({ precision: 12, scale: 2 }).notNull(),
  totalDiscount: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
  taxLines: jsonb().notNull().default([]),
  requiresShipping: boolean(),
  fulfillmentStatus: text(), // per-line tracking: unfulfilled | fulfilled | partial
})

export type OrderLineItem = typeof orderLineItems.$inferSelect
export type NewOrderLineItem = typeof orderLineItems.$inferInsert
