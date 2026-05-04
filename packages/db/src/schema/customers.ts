import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

export const customers = pgTable(
  'customers',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    email: text(),
    phone: text(),
    firstName: text(),
    lastName: text(),
    acceptsMarketing: boolean().notNull().default(false),
    totalSpent: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
    ordersCount: integer().notNull().default(0),
    tags: text().array().notNull().default(sql`'{}'`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('customers_shop_email_unique')
      .on(t.shopId, t.email)
      .where(sql`${t.email} is not null`),
    index('customers_shop_phone_idx').on(t.shopId, t.phone),
  ],
)

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
