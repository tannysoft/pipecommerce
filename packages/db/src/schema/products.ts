import { sql } from 'drizzle-orm'
import {
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Postgres tsvector — Drizzle ไม่มี built-in type, ใช้ customType
 */
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

/**
 * search_vector — เรียก IMMUTABLE wrapper function ที่ define ใน
 * migration 0002 (`compute_product_search_vector`).
 *
 * ทำไมต้องห่อ: Postgres ปฏิเสธ `array_to_string` + `to_tsvector` ตรงๆ
 * ใน GENERATED expression เพราะ mark เป็น STABLE จาก polymorphic type
 * system (แม้ปฏิบัติ immutable). ห่อด้วย IMMUTABLE wrapper = escape
 * hatch ที่ Postgres documented ไว้
 *
 * Logic ภายใน function:
 *   - title (weight A) + tags joined (weight B) + description stripped HTML (weight C)
 *   - tokenizer = 'simple' เพื่อรองรับ TH+EN
 *   - description ตัดที่ 4000 chars
 *
 * ดู docs/ARCHITECTURE.md#search--faceted-filter
 */
const searchVectorExpr = sql`public.compute_product_search_vector(title, tags, description)`

export const products = pgTable(
  'products',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    handle: text().notNull(), // URL slug
    description: text(), // HTML
    status: text().notNull().default('draft'), // draft | active | archived
    productType: text(),
    vendor: text(),
    tags: text().array().notNull().default(sql`'{}'`),
    seoTitle: text(),
    seoDescription: text(),

    searchVector: tsvector('search_vector').generatedAlwaysAs(searchVectorExpr),

    publishedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('products_shop_handle_unique').on(t.shopId, t.handle),
    index('products_shop_status_published_idx').on(t.shopId, t.status, t.publishedAt),
    index('products_search_idx').using('gin', t.searchVector),
    index('products_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
    index('products_handle_trgm_idx').using('gin', sql`${t.handle} gin_trgm_ops`),
  ],
)

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
