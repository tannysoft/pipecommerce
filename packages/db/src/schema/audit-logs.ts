import { sql } from 'drizzle-orm'
import { index, inet, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Audit log สำหรับทุก mutation สำคัญใน admin
 *
 * action examples: product.created, order.refunded, member.invited,
 *                  loyalty.adjust, theme.published, ...
 * changes = { before: {...}, after: {...} }
 *
 * user_id NULL = system action (cron, queue consumer)
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    userId: uuid(),
    action: text().notNull(),
    resourceType: text().notNull(),
    resourceId: uuid(),
    changes: jsonb(),
    ip: inet(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_shop_created_idx').on(t.shopId, sql`${t.createdAt} desc`)],
)

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
