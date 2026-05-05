import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { carts } from './carts.ts'
import { discounts } from './discounts.ts'

/**
 * Junction: discount codes ที่ user apply ใน cart (ก่อน checkout)
 *
 * เมื่อ checkout success → migrate เป็น order_discount_applications
 * (ตาราง snapshot ที่ละเอียดกว่า เก็บ amount_applied)
 */
export const cartDiscountCodes = pgTable(
  'cart_discount_codes',
  {
    cartId: uuid()
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    discountId: uuid()
      .notNull()
      .references(() => discounts.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.cartId, t.discountId] })],
)

export type CartDiscountCode = typeof cartDiscountCodes.$inferSelect
export type NewCartDiscountCode = typeof cartDiscountCodes.$inferInsert
