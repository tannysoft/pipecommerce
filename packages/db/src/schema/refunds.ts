import { numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id } from './_helpers.ts'
import { orders } from './orders.ts'
import { shops } from './shops.ts'

/**
 * Refund record — Beam refund ID เก็บไว้สำหรับ trace
 *
 * Refund partial = หลาย row ต่อ order
 * เมื่อ refund: enqueue loyalty-reverse (Phase 2g) เพื่อคืนแต้ม
 */
export const refunds = pgTable('refunds', {
  id: id(),
  orderId: uuid()
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  amount: numeric({ precision: 12, scale: 2 }).notNull(),
  reason: text(),
  note: text(),
  refundedBy: uuid(), // shop_members.user_id (no FK; auth schema separate)
  beamRefundId: text(), // id ฝั่ง Beam สำหรับ reconciliation
  createdAt: createdAt(),
})

export type Refund = typeof refunds.$inferSelect
export type NewRefund = typeof refunds.$inferInsert
