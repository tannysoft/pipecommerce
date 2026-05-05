import { boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id } from './_helpers.ts'
import { customers } from './customers.ts'
import { shops } from './shops.ts'

/**
 * Internal staff notes about a customer (CRM use)
 * created_by = shop_members.user_id (no FK; auth schema separate)
 */
export const customerNotes = pgTable('customer_notes', {
  id: id(),
  customerId: uuid()
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  note: text().notNull(),
  isPinned: boolean().notNull().default(false),
  createdAt: createdAt(),
  createdBy: uuid(),
})

export type CustomerNote = typeof customerNotes.$inferSelect
export type NewCustomerNote = typeof customerNotes.$inferInsert
