import { sql } from 'drizzle-orm'
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * shop_member ที่สมัคร receive scheduled report email (daily/weekly/monthly)
 *
 * recipient_email override ได้ — ไม่ต้องเป็น auth.users.email
 * reports = ['sales_overview', 'tax_collected', 'low_stock', 'top_products']
 *
 * (ดู ADR-017)
 */
export const reportEmailSubscriptions = pgTable(
  'report_email_subscriptions',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    userId: uuid().notNull(),
    type: text().notNull(), // daily | weekly | monthly
    recipientEmail: text().notNull(),
    reports: text().array().notNull(),
    isActive: boolean().notNull().default(true),
    lastSentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('report_email_subs_shop_user_type_unique').on(t.shopId, t.userId, t.type),
    index('report_email_subs_type_active_idx')
      .on(t.type, t.isActive)
      .where(sql`${t.isActive} = true`),
  ],
)

export type ReportEmailSubscription = typeof reportEmailSubscriptions.$inferSelect
export type NewReportEmailSubscription = typeof reportEmailSubscriptions.$inferInsert
