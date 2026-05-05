import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Short-lived token (~1h) ที่ editor ใช้ authenticate iframe preview
 * ของ draft state (ADR-013)
 *
 * token เป็น opaque random string ใน URL: ?theme_draft={token}
 * storefront verify token → render with draft settings/templates
 */
export const themeDraftTokens = pgTable(
  'theme_draft_tokens',
  {
    token: text().primaryKey(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    userId: uuid().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('theme_draft_tokens_expires_idx').on(t.expiresAt)],
)

export type ThemeDraftToken = typeof themeDraftTokens.$inferSelect
export type NewThemeDraftToken = typeof themeDraftTokens.$inferInsert
