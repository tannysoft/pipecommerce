import { integer, jsonb, numeric, pgTable, text } from 'drizzle-orm/pg-core'
import { id } from './_helpers.ts'

/**
 * Subscription plans ของแพลตฟอร์ม (Free, Basic, Pro, Enterprise)
 * — ลูกค้าจ่ายให้แพลตฟอร์มเรา ไม่ใช่ shop's customer
 *
 * features = { custom_domain: bool, api_access: bool, ... }
 * limits ที่จำกัดปริมาณเก็บที่ product_limit / staff_limit
 */
export const plans = pgTable('plans', {
  id: id(),
  name: text().notNull(),
  monthlyPrice: numeric({ precision: 12, scale: 2 }).notNull(),
  features: jsonb().notNull(),
  productLimit: integer(),
  staffLimit: integer(),
})

export type Plan = typeof plans.$inferSelect
export type NewPlan = typeof plans.$inferInsert
