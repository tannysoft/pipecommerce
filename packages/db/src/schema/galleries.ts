import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Image gallery — group ของรูปที่ shop จัดเป็น collection อิสระ
 * (ไม่ใช่ collection ของสินค้า)
 *
 * Use cases: portfolio, look book, behind-the-scenes, event photos
 *
 * URL: /galleries/{handle}
 *
 * status: draft | active | archived (เหมือน pages/articles)
 */
export const galleries = pgTable(
  'galleries',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    handle: text().notNull(),
    description: text(),
    status: text().notNull().default('draft'),
    seoTitle: text(),
    seoDescription: text(),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('galleries_shop_handle_unique').on(t.shopId, t.handle),
    index('galleries_shop_status_idx').on(t.shopId, t.status),
  ],
)

export type Gallery = typeof galleries.$inferSelect
export type NewGallery = typeof galleries.$inferInsert
