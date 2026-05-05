import { sql } from 'drizzle-orm'
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, updatedAt } from './_helpers.ts'
import { articles } from './articles.ts'
import { shops } from './shops.ts'

/**
 * Article images — pipeline เดียวกับ product_images
 * (R2: shops/{shop_id}/orig/{uuid}.{ext} + variants low/mid/high)
 *
 * 1 article มีได้หลายรูป — featured image กำหนดที่ articles.featured_image_id
 *
 * ดู ADR-007 (image pipeline)
 */
export const articleImages = pgTable('article_images', {
  id: id(),
  articleId: uuid()
    .notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  uuid: uuid().notNull().unique().default(sql`gen_random_uuid()`),
  ext: text().notNull(),
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

export type ArticleImage = typeof articleImages.$inferSelect
export type NewArticleImage = typeof articleImages.$inferInsert
