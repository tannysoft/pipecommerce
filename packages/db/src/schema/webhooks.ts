import { boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Outbound webhook subscription — shop owner ตั้งให้รับ event จากระบบเรา
 * ไปยัง URL ภายนอก (Zapier, n8n, custom backend, ...)
 *
 * topics: order.created, order.paid, order.shipped, customer.created,
 *         loyalty.points_earned, ...
 *
 * secret: HMAC-SHA256 secret ที่ลูกค้าใช้ verify signature ของแต่ละ delivery
 *
 * (ดู docs/ARCHITECTURE.md#external-integrations-phase-3 — groundwork)
 */
export const webhooks = pgTable('webhooks', {
  id: id(),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  url: text().notNull(),
  topics: text().array().notNull(),
  secret: text().notNull(),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export type Webhook = typeof webhooks.$inferSelect
export type NewWebhook = typeof webhooks.$inferInsert
