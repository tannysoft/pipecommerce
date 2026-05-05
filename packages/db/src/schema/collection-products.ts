import { integer, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { collections } from './collections.ts'
import { products } from './products.ts'

/**
 * Many-to-many junction ระหว่าง collections ↔ products
 * ใช้สำหรับ manual collection (smart collection ไม่ได้ใส่ row ที่นี่)
 *
 * position ใช้สำหรับเรียงสินค้าใน collection (drag-drop ใน admin)
 */
export const collectionProducts = pgTable(
  'collection_products',
  {
    collectionId: uuid()
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    position: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.productId] })],
)

export type CollectionProduct = typeof collectionProducts.$inferSelect
export type NewCollectionProduct = typeof collectionProducts.$inferInsert
