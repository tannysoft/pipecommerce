import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { shops } from './shops.ts'

/**
 * Per-shop toggle ของ auth providers + customer-facing settings ใน storefront
 *
 * 1 row ต่อ shop (PK = shop_id). Default = email magic link เปิด, social ปิด
 * — ร้านเปิดเองตอน setup OAuth ใน admin
 */
export const shopAuthSettings = pgTable('shop_auth_settings', {
  shopId: uuid()
    .primaryKey()
    .references(() => shops.id, { onDelete: 'cascade' }),
  emailEnabled: boolean().notNull().default(true), // magic link
  googleEnabled: boolean().notNull().default(false),
  facebookEnabled: boolean().notNull().default(false),
  lineEnabled: boolean().notNull().default(false), // Phase 2 LINE
  guestCheckoutEnabled: boolean().notNull().default(true),
  requireEmailVerification: boolean().notNull().default(false),
  customRedirectAfterLogin: text(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid(),
})

export type ShopAuthSettings = typeof shopAuthSettings.$inferSelect
export type NewShopAuthSettings = typeof shopAuthSettings.$inferInsert
