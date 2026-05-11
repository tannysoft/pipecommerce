import { jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth.ts'
import { shops } from './shops.ts'

export const shopMembers = pgTable(
  'shop_members',
  {
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text().notNull(), // owner | admin | staff | viewer
    permissions: jsonb().notNull().default({}),
    invitedAt: timestamp({ withTimezone: true }),
    acceptedAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.userId] })],
)

export type ShopMember = typeof shopMembers.$inferSelect
export type NewShopMember = typeof shopMembers.$inferInsert
