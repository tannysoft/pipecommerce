import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { shops } from './shops.ts'
import { themes } from './themes.ts'

/**
 * 1 row per shop — เก็บทั้ง published (live) + draft (editor preview)
 *
 * publish flow: copy draft_* → settings/templates atomic + revalidate cache
 * (ดู ADR-013)
 */
export const shopThemeSettings = pgTable('shop_theme_settings', {
  shopId: uuid()
    .primaryKey()
    .references(() => shops.id, { onDelete: 'cascade' }),
  themeId: uuid()
    .notNull()
    .references(() => themes.id, { onDelete: 'restrict' }),
  themeCode: text().notNull(), // snapshot
  themeVersion: text().notNull(), // pinned

  // published (live)
  settings: jsonb().notNull().default({}),
  templates: jsonb().notNull().default({}),
  publishedAt: timestamp({ withTimezone: true }),
  publishedBy: uuid(),

  // draft (editor preview)
  draftSettings: jsonb(),
  draftTemplates: jsonb(),
  draftUpdatedAt: timestamp({ withTimezone: true }),
  draftUpdatedBy: uuid(),

  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export type ShopThemeSettings = typeof shopThemeSettings.$inferSelect
export type NewShopThemeSettings = typeof shopThemeSettings.$inferInsert
