import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { products } from './products.ts'
import { shops } from './shops.ts'

/**
 * Variant = สินค้าจริงที่ขาย (1 product มีได้หลาย variant)
 *
 * shop_id denormalized สำหรับ RLS performance
 * cost_per_item = ต้นทุน private — ห้ามแสดง public
 */
export const productVariants = pgTable(
  'product_variants',
  {
    id: id(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    sku: text(),
    barcode: text(),
    title: text().notNull(), // "Red / M"
    option1: text(),
    option2: text(),
    option3: text(),
    price: numeric({ precision: 12, scale: 2 }).notNull(),
    compareAtPrice: numeric({ precision: 12, scale: 2 }),
    costPerItem: numeric({ precision: 12, scale: 2 }),
    weightGrams: integer(),
    requiresShipping: boolean().notNull().default(true),
    taxable: boolean().notNull().default(true),
    position: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('product_variants_shop_sku_unique')
      .on(t.shopId, t.sku)
      .where(sql`${t.sku} is not null`),
    index('product_variants_product_idx').on(t.productId),
  ],
)

export type ProductVariant = typeof productVariants.$inferSelect
export type NewProductVariant = typeof productVariants.$inferInsert
