import { sql } from 'drizzle-orm'
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Bulk import/export job tracking
 *
 * resource:
 *   import: products | customers | inventory | discounts
 *   export: products | customers | orders | inventory | discounts |
 *           report_sales_overview | report_tax_collected | report_low_stock | ...
 *
 * Pipeline: upload CSV → R2 → enqueue bulk-import → consumer chunk
 *           100 rows/transaction → progress polling
 *
 * errors = [{ row, message }] cap 100 entries
 *
 * ดู ADR-016 + ADR-017 (reports CSV reuses this pipeline)
 */
export const bulkJobs = pgTable(
  'bulk_jobs',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    type: text().notNull(), // import | export
    resource: text().notNull(),
    status: text().notNull(), // queued | processing | completed | failed | cancelled

    sourceR2Key: text(),
    options: jsonb().notNull().default({}),

    totalRows: integer(),
    rowsProcessed: integer().notNull().default(0),
    rowsSucceeded: integer().notNull().default(0),
    rowsFailed: integer().notNull().default(0),
    errors: jsonb().notNull().default([]),

    resultR2Key: text(),
    resultUrl: text(),

    createdAt: createdAt(),
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    createdBy: uuid(),
  },
  (t) => [
    index('bulk_jobs_shop_created_idx').on(t.shopId, sql`${t.createdAt} desc`),
    index('bulk_jobs_status_active_idx')
      .on(t.status)
      .where(sql`${t.status} in ('queued', 'processing')`),
  ],
)

export type BulkJob = typeof bulkJobs.$inferSelect
export type NewBulkJob = typeof bulkJobs.$inferInsert
