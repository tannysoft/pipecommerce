import { sql } from 'drizzle-orm'
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id } from './_helpers.ts'
import { shops } from './shops.ts'

export const shopDomains = pgTable(
  'shop_domains',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    hostname: text().notNull().unique(),
    isPrimary: boolean().notNull().default(false),
    sslStatus: text().notNull().default('pending'), // pending | active | failed | revoked
    cfHostnameId: text(),
    verifiedAt: timestamp({ withTimezone: true }),
    lastCheckedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('shop_domains_hostname_idx').on(t.hostname),
    uniqueIndex('shop_domains_primary_unique')
      .on(t.shopId)
      .where(sql`${t.isPrimary} = true`),
  ],
)

export type ShopDomain = typeof shopDomains.$inferSelect
export type NewShopDomain = typeof shopDomains.$inferInsert
