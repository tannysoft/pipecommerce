import { sql } from 'drizzle-orm'
import { integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Theme asset (logo, favicon, section image, ...) — pipeline เดียวกับ
 * product_images (R2 + 3 variants low/mid/high gen ตอน upload)
 *
 * key = 'logo' | 'favicon' | 'hero-bg' | section-{id}-image | ...
 * URL pattern: cdn.yourapp.com/shops/{shop_id}/img/{uuid}/{low|mid|high}.webp
 */
export const shopThemeAssets = pgTable(
  'shop_theme_assets',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    uuid: uuid().notNull().unique().default(sql`gen_random_uuid()`),
    ext: text().notNull(),
    r2KeyOrig: text().notNull(),
    alt: text(),
    width: integer(),
    height: integer(),
    bytes: integer(),
    variantsStatus: text().notNull().default('pending'), // pending | processing | ready | failed
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('shop_theme_assets_shop_key_unique')
      .on(t.shopId, t.key)
      .where(sql`${t.deletedAt} is null`),
  ],
)

export type ShopThemeAsset = typeof shopThemeAssets.$inferSelect
export type NewShopThemeAsset = typeof shopThemeAssets.$inferInsert
