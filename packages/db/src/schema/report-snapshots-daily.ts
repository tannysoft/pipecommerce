import { date, integer, jsonb, numeric, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { shops } from './shops.ts'

/**
 * Pre-aggregated daily sales for the admin dashboard + email digests.
 * Cron computes the previous day at 02:00 ICT (ADR-017).
 *
 * total_tax_collected ≠ total_tax_owed when tax mode = shop_absorbs
 *   collected = customer ที่จ่าย
 *   owed      = ที่ต้องส่งรัฐ (รวม shop_absorbs ที่ shop จ่ายเอง)
 * (ดู ADR-018)
 *
 * top_products + top_collections + top_discounts pre-computed (cap 10)
 * เพื่อให้ dashboard render ทันทีโดยไม่ต้อง JOIN
 */
export const reportSnapshotsDaily = pgTable(
  'report_snapshots_daily',
  {
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    date: date().notNull(), // shop's local date

    // sales
    ordersCount: integer().notNull().default(0),
    ordersPaid: integer().notNull().default(0),
    ordersCancelled: integer().notNull().default(0),
    grossRevenue: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
    netRevenue: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
    totalTaxCollected: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
    totalTaxOwed: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
    totalDiscounts: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
    totalShipping: numeric({ precision: 14, scale: 2 }).notNull().default('0'),

    // refunds
    refundsCount: integer().notNull().default(0),
    refundsAmount: numeric({ precision: 14, scale: 2 }).notNull().default('0'),

    // customers
    customersNew: integer().notNull().default(0),
    customersReturning: integer().notNull().default(0),

    unitsSold: integer().notNull().default(0),

    // loyalty
    pointsEarned: integer().notNull().default(0),
    pointsRedeemed: integer().notNull().default(0),

    // top items (pre-computed cap 10)
    topProducts: jsonb().notNull().default([]),
    topCollections: jsonb().notNull().default([]),
    topDiscounts: jsonb().notNull().default([]),

    computedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.date] })],
)

export type ReportSnapshotDaily = typeof reportSnapshotsDaily.$inferSelect
export type NewReportSnapshotDaily = typeof reportSnapshotsDaily.$inferInsert
