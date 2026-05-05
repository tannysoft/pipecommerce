import { sql } from 'drizzle-orm'
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, updatedAt } from './_helpers.ts'
import { products } from './products.ts'
import { productVariants } from './product-variants.ts'
import { shops } from './shops.ts'

/**
 * รูปสินค้า — ต้นฉบับเก็บใน R2 ที่ shops/{shop_id}/orig/{uuid}.{ext}
 * variants (low/mid/high) generate ตอน upload ผ่าน CF Queue image-process
 *
 * URL pattern: cdn.yourapp.com/shops/{shop_id}/img/{uuid}/{low|mid|high}.webp
 *
 * ดู docs/ARCHITECTURE.md#image-pipeline และ ADR-007
 */
export const productImages = pgTable('product_images', {
  id: id(),
  productId: uuid()
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid().references(() => productVariants.id, { onDelete: 'set null' }),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  uuid: uuid().notNull().unique().default(sql`gen_random_uuid()`), // ใช้ใน R2 path
  ext: text().notNull(), // jpg | png | webp ของต้นฉบับ
  r2KeyOrig: text().notNull(),
  alt: text(),
  position: integer().notNull().default(0),
  width: integer(),
  height: integer(),
  bytes: integer(),
  variantsStatus: text().notNull().default('pending'), // pending | processing | ready | failed
  variantsError: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
})

export type ProductImage = typeof productImages.$inferSelect
export type NewProductImage = typeof productImages.$inferInsert
