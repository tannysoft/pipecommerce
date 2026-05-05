import { boolean, index, integer, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Tax rate per (shop, country, province) — รองรับ multi-region
 *
 * province NULL = ใช้ทั้ง country
 * applies_to = all | shipping | product
 * is_compound = ภาษีซ้อน (tax on tax) — รองรับ Canada/QC ในอนาคต
 *
 * ดู docs/ARCHITECTURE.md#tax-calculation
 *
 * shop_absorbs / inclusive / exclusive (3 modes) เก็บใน shops.settings.tax
 * ไม่ใช่ที่ตารางนี้ — ตารางนี้เก็บแค่ "rate" ต่อ region
 */
export const taxRates = pgTable(
  'tax_rates',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    name: text().notNull(), // "VAT", "Sales Tax CA"
    rate: numeric({ precision: 5, scale: 4 }).notNull(), // 0.0700 = 7%
    country: text(), // 'TH'
    province: text(), // NULL = whole country
    appliesTo: text().notNull().default('all'), // all | shipping | product
    isCompound: boolean().notNull().default(false),
    isDefault: boolean().notNull().default(false),
    priority: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('tax_rates_shop_region_applies_unique').on(
      t.shopId,
      t.country,
      t.province,
      t.appliesTo,
    ),
    index('tax_rates_shop_country_province_idx').on(t.shopId, t.country, t.province),
  ],
)

export type TaxRate = typeof taxRates.$inferSelect
export type NewTaxRate = typeof taxRates.$inferInsert
