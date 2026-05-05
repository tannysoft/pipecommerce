import { pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customerGroups } from './customer-groups.ts'
import { customers } from './customers.ts'
import { shops } from './shops.ts'

/**
 * Junction: customer ↔ group
 * added_by = manual (admin คลิก) | rule (auto eval) | api
 */
export const customerGroupMembers = pgTable(
  'customer_group_members',
  {
    groupId: uuid()
      .notNull()
      .references(() => customerGroups.id, { onDelete: 'cascade' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    addedBy: text().notNull(), // manual | rule | api
  },
  (t) => [primaryKey({ columns: [t.groupId, t.customerId] })],
)

export type CustomerGroupMember = typeof customerGroupMembers.$inferSelect
export type NewCustomerGroupMember = typeof customerGroupMembers.$inferInsert
