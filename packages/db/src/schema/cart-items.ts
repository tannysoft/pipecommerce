import { sql } from 'drizzle-orm'
import { check, integer, pgTable, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id } from './_helpers.ts'
import { carts } from './carts.ts'
import { productVariants } from './product-variants.ts'

/**
 * Cart line item — ⚠ ไม่ snapshot ราคา ที่นี่
 * คำนวณ price + tax + discount ตอน checkout (ดึงจาก variant ปัจจุบัน)
 */
export const cartItems = pgTable(
  'cart_items',
  {
    id: id(),
    cartId: uuid()
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [check('cart_items_quantity_positive', sql`${t.quantity} > 0`)],
)

export type CartItem = typeof cartItems.$inferSelect
export type NewCartItem = typeof cartItems.$inferInsert
