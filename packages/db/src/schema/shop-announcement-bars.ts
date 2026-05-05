import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Top-of-page bar: rotating message + countdown + dismissible
 *
 * messages = [{ text, link, link_text, icon }]
 * show_on  = all | home_only | exclude_checkout
 * Dismiss = client cookie (ไม่ track per-user)
 */
export const shopAnnouncementBars = pgTable(
  'shop_announcement_bars',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    isActive: boolean().notNull().default(true),

    messages: jsonb().notNull(),
    rotateSeconds: integer().notNull().default(0), // 0 = ไม่หมุน

    backgroundColor: text(),
    textColor: text(),

    isDismissible: boolean().notNull().default(true),
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    showOn: text().notNull().default('all'),
    countdownTo: timestamp({ withTimezone: true }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('announcement_bars_shop_active_idx').on(t.shopId, t.isActive)],
)

export type ShopAnnouncementBar = typeof shopAnnouncementBars.$inferSelect
export type NewShopAnnouncementBar = typeof shopAnnouncementBars.$inferInsert
