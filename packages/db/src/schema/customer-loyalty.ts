import { index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customers } from './customers.ts'
import { loyaltyPrograms } from './loyalty-programs.ts'
import { shops } from './shops.ts'

/**
 * Per-customer loyalty cache — source of truth = loyalty_ledger
 *
 * คาดเดาว่า drift ได้ — มี nightly cron reconcile balance จาก ledger
 * เพื่อกัน race condition. ดู ADR-016
 *
 * customer_id เป็น PK (1 customer = 1 enrollment เพราะ 1 program/shop)
 */
export const customerLoyalty = pgTable(
  'customer_loyalty',
  {
    customerId: uuid()
      .primaryKey()
      .references(() => customers.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    programId: uuid()
      .notNull()
      .references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),
    pointsBalance: integer().notNull().default(0),
    pointsLifetime: integer().notNull().default(0),
    pointsExpiringSoon: integer().notNull().default(0),
    nextExpiryAt: timestamp({ withTimezone: true }),
    enrolledAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('customer_loyalty_shop_balance_idx').on(t.shopId, t.pointsBalance)],
)

export type CustomerLoyalty = typeof customerLoyalty.$inferSelect
export type NewCustomerLoyalty = typeof customerLoyalty.$inferInsert
