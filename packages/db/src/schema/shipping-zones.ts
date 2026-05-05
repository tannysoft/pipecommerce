import { sql } from 'drizzle-orm'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { id } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Shipping zone = กลุ่มของ destination ที่ใช้ rate เดียวกัน
 * เช่น "ในประเทศ" (TH), "ASEAN", "ต่างประเทศ"
 *
 * provinces NULL = ทั้ง country
 */
export const shippingZones = pgTable('shipping_zones', {
  id: id(),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  countries: text().array().notNull().default(sql`'{}'`), // ['TH', 'LA']
  provinces: text().array(), // NULL = all of country
})

export type ShippingZone = typeof shippingZones.$inferSelect
export type NewShippingZone = typeof shippingZones.$inferInsert
