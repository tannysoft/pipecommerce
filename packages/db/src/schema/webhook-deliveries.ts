import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id } from './_helpers.ts'
import { shops } from './shops.ts'
import { webhooks } from './webhooks.ts'

/**
 * Delivery log ต่อ webhook event — รองรับ retry + visibility
 *
 * status: pending | success | failed
 * next_retry_at = exponential backoff (1m, 5m, 30m, 2h, ... cap 7 ครั้ง)
 *
 * Index บน (status, next_retry_at) สำหรับ retry job ดึง batch
 */
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: id(),
    webhookId: uuid()
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    topic: text().notNull(),
    payload: jsonb().notNull(),
    status: text().notNull(), // pending | success | failed
    responseCode: integer(),
    responseBody: text(),
    attempts: integer().notNull().default(0),
    nextRetryAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    deliveredAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('webhook_deliveries_status_retry_idx').on(t.status, t.nextRetryAt)],
)

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert
