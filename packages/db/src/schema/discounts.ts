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
import { shops } from './shops.ts'

/**
 * Discount rule — รองรับทั้ง code-based และ automatic
 *
 * type:
 *   percentage    — value = % off (เช่น 20)
 *   fixed_amount  — value = บาทต่อ line/order
 *   free_shipping — value ไม่ใช้
 *   bxgy          — buy X get Y (rules ใน combines_with หรือ extension)
 *
 * applies_to + target_ids = scope (all | products | collections)
 * customer_eligibility + customer_ids = ใครใช้ได้
 *
 * combines_with = { product, order, shipping } เป็น boolean per category
 *
 * code IS NULL → automatic discount (apply ทุก eligible cart)
 * UNIQUE(shop, code) WHERE code IS NOT NULL → ห้าม code ซ้ำใน shop เดียว
 */
export const discounts = pgTable(
  'discounts',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    code: text(), // NULL = automatic
    title: text().notNull(),
    status: text().notNull(), // active | expired | scheduled | disabled

    type: text().notNull(), // percentage | fixed_amount | free_shipping | bxgy
    value: numeric({ precision: 12, scale: 2 }),
    appliesTo: text().notNull(), // all | products | collections
    targetIds: uuid().array().notNull().default(sql`'{}'`),

    minimumAmount: numeric({ precision: 12, scale: 2 }),
    minimumQuantity: integer(),
    customerEligibility: text().notNull(), // all | specific
    customerIds: uuid().array().notNull().default(sql`'{}'`),

    usageLimit: integer(), // รวมทั้งหมด NULL = ไม่จำกัด
    usageLimitPerCustomer: integer(),
    usedCount: integer().notNull().default(0),

    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),

    combinesWith: jsonb()
      .notNull()
      .default({ product: false, order: false, shipping: false }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('discounts_shop_code_unique')
      .on(t.shopId, t.code)
      .where(sql`${t.code} is not null`),
    index('discounts_shop_status_idx').on(t.shopId, t.status),
  ],
)

export type Discount = typeof discounts.$inferSelect
export type NewDiscount = typeof discounts.$inferInsert
