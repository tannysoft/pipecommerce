import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { customers } from './customers.ts'
import { shops } from './shops.ts'

/**
 * Cart ทั้ง guest + logged-in customer
 *
 * token = opaque random ส่งให้ client เก็บ cookie (32 chars)
 * expires_at = cleanup เมื่อหมดอายุ (cron + abandoned-cart queue)
 *
 * customer_id nullable — guest cart ที่ยังไม่ได้ login
 */
export const carts = pgTable(
  'carts',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
    token: text().notNull().unique(),
    currency: text().notNull(),
    note: text(),
    abandonedEmailSentAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('carts_shop_customer_idx').on(t.shopId, t.customerId),
    index('carts_expires_at_idx')
      .on(t.expiresAt)
      .where(sql`${t.customerId} is not null`),
  ],
)

export type Cart = typeof carts.$inferSelect
export type NewCart = typeof carts.$inferInsert
