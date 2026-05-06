import { sql } from 'drizzle-orm'
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, updatedAt } from './_helpers.ts'
import { galleries } from './galleries.ts'
import { shops } from './shops.ts'

/**
 * Gallery images — pipeline เดียวกับ product_images / article_images
 * (R2: shops/{shop_id}/orig/{uuid}.{ext})
 *
 * 1 gallery มีได้หลายรูป — เรียงตาม position
 * caption ต่างจาก alt: alt = a11y, caption = ข้อความใต้รูป
 */
export const galleryImages = pgTable('gallery_images', {
  id: id(),
  galleryId: uuid()
    .notNull()
    .references(() => galleries.id, { onDelete: 'cascade' }),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  uuid: uuid().notNull().unique().default(sql`gen_random_uuid()`),
  ext: text().notNull(),
  r2KeyOrig: text().notNull(),
  alt: text(),
  caption: text(),
  position: integer().notNull().default(0),
  width: integer(),
  height: integer(),
  bytes: integer(),
  variantsStatus: text().notNull().default('pending'),
  variantsError: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
})

export type GalleryImage = typeof galleryImages.$inferSelect
export type NewGalleryImage = typeof galleryImages.$inferInsert
