import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { customers } from './customers.ts'
import { shops } from './shops.ts'

/**
 * Customer shipping addresses — N per customer
 *
 * is_default unique per customer (partial index) — 1 default at most
 * ใช้ตอน checkout เป็น preset, customer แก้ไขใน /account/addresses
 */
export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: id(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),

    label: text(), // "บ้าน", "ที่ทำงาน" — optional
    recipientName: text().notNull(),
    phone: text(),
    line1: text().notNull(),
    line2: text(),
    subdistrict: text(), // ตำบล/แขวง
    district: text(), // อำเภอ/เขต
    province: text().notNull(),
    postalCode: text().notNull(),
    country: text().notNull().default('TH'),
    isDefault: boolean().notNull().default(false),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('customer_addresses_customer_idx').on(t.customerId),
    uniqueIndex('customer_addresses_default_unique')
      .on(t.customerId)
      .where(sql`${t.isDefault} = true`),
  ],
)

export type CustomerAddress = typeof customerAddresses.$inferSelect
export type NewCustomerAddress = typeof customerAddresses.$inferInsert
