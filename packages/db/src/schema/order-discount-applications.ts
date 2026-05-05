import { numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { id } from './_helpers.ts'
import { discounts } from './discounts.ts'
import { orders } from './orders.ts'

/**
 * Snapshot ของ discount ที่ใช้ใน order (ครบทุก field สำหรับ audit)
 *
 * discount_id nullable เผื่อ discount ถูกลบ (ON DELETE SET NULL)
 *   — code + type + value + amount_applied ยัง snapshot อยู่ที่นี่
 */
export const orderDiscountApplications = pgTable('order_discount_applications', {
  id: id(),
  orderId: uuid()
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  discountId: uuid().references(() => discounts.id, { onDelete: 'set null' }),
  code: text(), // snapshot
  type: text().notNull(), // percentage | fixed_amount | free_shipping | bxgy
  value: numeric({ precision: 12, scale: 2 }).notNull(),
  amountApplied: numeric({ precision: 12, scale: 2 }).notNull(),
})

export type OrderDiscountApplication = typeof orderDiscountApplications.$inferSelect
export type NewOrderDiscountApplication = typeof orderDiscountApplications.$inferInsert
