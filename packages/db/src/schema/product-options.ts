import { sql } from 'drizzle-orm'
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { id } from './_helpers.ts'
import { products } from './products.ts'

/**
 * ตัวเลือกสินค้า เช่น Size / Color / Material
 *
 * 1 product มีได้สูงสุด 3 options (ตาม Shopify model) — ตรงกับ
 * option1/option2/option3 ใน product_variants
 */
export const productOptions = pgTable('product_options', {
  id: id(),
  productId: uuid()
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  name: text().notNull(), // "Size", "Color"
  position: integer().notNull(),
  values: text().array().notNull().default(sql`'{}'`), // ['S', 'M', 'L']
})

export type ProductOption = typeof productOptions.$inferSelect
export type NewProductOption = typeof productOptions.$inferInsert
