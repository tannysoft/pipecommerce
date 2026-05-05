import { jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { productImages } from './product-images.ts'
import { shops } from './shops.ts'

/**
 * Collection (หมวดหมู่/category)
 *
 * type = 'manual' → admin เลือก product เอง (ผ่านตาราง collection_products)
 * type = 'smart'  → auto-include ตามเงื่อนไขใน rules jsonb
 */
export const collections = pgTable(
  'collections',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    handle: text().notNull(),
    description: text(),
    type: text().notNull().default('manual'), // manual | smart
    rules: jsonb(), // สำหรับ smart collection
    imageId: uuid().references(() => productImages.id, { onDelete: 'set null' }),
    seoTitle: text(),
    seoDescription: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('collections_shop_handle_unique').on(t.shopId, t.handle)],
)

export type Collection = typeof collections.$inferSelect
export type NewCollection = typeof collections.$inferInsert
