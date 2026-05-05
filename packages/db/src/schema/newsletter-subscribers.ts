import { sql } from 'drizzle-orm'
import { index, inet, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { customers } from './customers.ts'
import { shops } from './shops.ts'

/**
 * Email list สำหรับ marketing campaign + welcome offer
 *
 * PDPA fields: ip, user_agent, consent_text — เก็บเป็น proof of consent
 * unsubscribe_token = HMAC ของ (shop_id + email + secret) → 1-click link
 *
 * source: footer | popup | checkout | manual_import | api
 */
export const newsletterSubscribers = pgTable(
  'newsletter_subscribers',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    email: text().notNull(),
    customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
    source: text().notNull(),
    status: text().notNull(), // subscribed | unsubscribed | bounced

    // PDPA consent log
    ip: inet(),
    userAgent: text(),
    consentText: text(),
    subscribedAt: timestamp({ withTimezone: true }).notNull(),
    unsubscribedAt: timestamp({ withTimezone: true }),
    unsubscribeToken: text().notNull(),

    tags: text().array().notNull().default(sql`'{}'`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('newsletter_shop_email_unique').on(t.shopId, t.email),
    index('newsletter_shop_status_idx').on(t.shopId, t.status),
  ],
)

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert
