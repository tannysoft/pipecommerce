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

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

/**
 * Article (blog post / news) — 1 implicit blog per shop ใน MVP
 * (ไม่มี blogs table — multi-blog ค่อยทำ P2 ถ้าจำเป็น)
 *
 * featured_image_id → article_images.id (FK ใส่ทีหลังหลัง article_images
 * ถูกสร้าง — ดู migration generated)
 *
 * author_user_id = shop_members.user_id (no FK — auth schema separate)
 * author_name snapshot ไว้เผื่อ user ลบ
 *
 * search_vector = title (A) + tags (B) + body stripped HTML (C)
 *   ผ่าน compute_article_search_vector() (migration 0014)
 *
 * URL: /blog/{handle}
 */
export const articles = pgTable(
  'articles',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    handle: text().notNull(),
    body: text(), // HTML
    excerpt: text(),

    featuredImageId: uuid(), // FK to article_images.id (legacy — managed via image-actions.ts)
    featuredImageUrl: text(), // R2 public URL — new path: ImageUploadField เก็บ URL ตรงๆ
    authorUserId: uuid(),
    authorName: text(), // snapshot

    status: text().notNull().default('draft'), // draft | active | archived
    tags: text().array().notNull().default(sql`'{}'`),
    seoTitle: text(),
    seoDescription: text(),

    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`public.compute_article_search_vector(title, tags, body)`,
    ),

    publishedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('articles_shop_handle_unique').on(t.shopId, t.handle),
    index('articles_shop_status_published_idx').on(t.shopId, t.status, t.publishedAt),
    index('articles_search_idx').using('gin', t.searchVector),
    index('articles_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
    index('articles_handle_trgm_idx').using('gin', sql`${t.handle} gin_trgm_ops`),
  ],
)

export type Article = typeof articles.$inferSelect
export type NewArticle = typeof articles.$inferInsert
