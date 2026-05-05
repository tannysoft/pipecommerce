import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * 301/302 redirect manager — middleware lookup ที่ storefront edge
 *
 * Auto-create เมื่อ admin เปลี่ยน product handle (เก่า → ใหม่)
 * ผ่าน packages/core/seo
 *
 * UNIQUE บน active rows เท่านั้น — disable + re-create ได้
 *
 * (ดู docs/SEO.md)
 */
export const seoRedirects = pgTable(
  'seo_redirects',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    fromPath: text().notNull(), // /products/old-handle
    toPath: text().notNull(),
    type: integer().notNull().default(301), // 301 | 302
    isActive: boolean().notNull().default(true),
    hitsCount: integer().notNull().default(0),
    lastHitAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: uuid(),
  },
  (t) => [
    uniqueIndex('seo_redirects_shop_from_active_unique')
      .on(t.shopId, t.fromPath)
      .where(sql`${t.isActive} = true`),
    index('seo_redirects_shop_active_idx').on(t.shopId, t.isActive),
  ],
)

export type SeoRedirect = typeof seoRedirects.$inferSelect
export type NewSeoRedirect = typeof seoRedirects.$inferInsert
