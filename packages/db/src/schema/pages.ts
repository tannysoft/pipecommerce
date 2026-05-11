import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Static pages: about, contact, faq, terms, privacy, shipping-policy, ...
 *
 * template_suffix = optional ให้ theme render ด้วย template ต่างจาก default
 *   เช่น 'contact' → page.contact.tsx (มี form), 'faq' → accordion layout
 *
 * URL: /pages/{handle}
 *
 * ไม่มี search_vector — pages = static, ไม่ index ใน main search
 * (ถ้าต้องการ FAQ search อนาคต ค่อยเพิ่ม)
 */
export const pages = pgTable(
  'pages',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    handle: text().notNull(),
    body: text(), // HTML
    featuredImageUrl: text(), // R2 public URL — เก็บ URL ตรงๆ ไม่มี image table แยก
    templateSuffix: text(), // optional theme template variant
    status: text().notNull().default('draft'), // draft | active | archived
    seoTitle: text(),
    seoDescription: text(),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('pages_shop_handle_unique').on(t.shopId, t.handle),
    index('pages_shop_status_published_idx').on(t.shopId, t.status, t.publishedAt),
  ],
)

export type Page = typeof pages.$inferSelect
export type NewPage = typeof pages.$inferInsert
