import { boolean, jsonb, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { id } from './_helpers.ts'
import { shippingZones } from './shipping-zones.ts'
import { shops } from './shops.ts'

/**
 * Shipping rate ใน 1 zone — รองรับ
 *   flat         — price คงที่
 *   weight_based — conditions = { min_weight, max_weight }
 *   price_based  — conditions = { min_price, max_price }
 */
export const shippingRates = pgTable('shipping_rates', {
  id: id(),
  zoneId: uuid()
    .notNull()
    .references(() => shippingZones.id, { onDelete: 'cascade' }),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  name: text().notNull(), // "EMS", "Kerry", "Flash"
  type: text().notNull(), // flat | weight_based | price_based
  price: numeric({ precision: 12, scale: 2 }),
  conditions: jsonb(),
  isActive: boolean().notNull().default(true),
})

export type ShippingRate = typeof shippingRates.$inferSelect
export type NewShippingRate = typeof shippingRates.$inferInsert
