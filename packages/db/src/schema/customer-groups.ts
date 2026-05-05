import { jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Customer group เช่น VIP, Wholesale
 *
 * type = 'manual' → admin add member ด้วยตนเอง (ผ่าน customer_group_members)
 * type = 'automatic' → rule-based, evaluate ตาม customer behavior
 *
 * perks = { price_list_id, free_shipping, discount_pct, tax_exempt }
 */
export const customerGroups = pgTable(
  'customer_groups',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    type: text().notNull(), // manual | automatic
    rules: jsonb(), // automatic: { min_lifetime_spend: 10000, ... }
    perks: jsonb().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('customer_groups_shop_name_unique').on(t.shopId, t.name)],
)

export type CustomerGroup = typeof customerGroups.$inferSelect
export type NewCustomerGroup = typeof customerGroups.$inferInsert
