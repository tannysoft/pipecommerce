import { inet, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id } from './_helpers.ts'
import { customers } from './customers.ts'
import { shops } from './shops.ts'

/**
 * Customer session — id ของ row นี้ = jti ใน JWT
 *
 * ใช้เป็น revocation list: เมื่อ logout-all-devices หรือเรา revoke session
 * → set revoked_at, JWT verify ตอนเข้าระบบจะตรวจ jti กับ revoked_at
 */
export const customerSessions = pgTable('customer_sessions', {
  id: id(), // = JWT jti
  customerId: uuid()
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  userAgent: text(),
  ip: inet(),
  issuedAt: createdAt(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  revokedAt: timestamp({ withTimezone: true }),
  lastSeenAt: timestamp({ withTimezone: true }),
})

export type CustomerSession = typeof customerSessions.$inferSelect
export type NewCustomerSession = typeof customerSessions.$inferInsert
