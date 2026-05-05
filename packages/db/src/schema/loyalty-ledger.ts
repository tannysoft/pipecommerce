import { sql } from 'drizzle-orm'
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id } from './_helpers.ts'
import { customers } from './customers.ts'
import { loyaltyPrograms } from './loyalty-programs.ts'
import { shops } from './shops.ts'

/**
 * ⚠ APPEND-ONLY ledger — ห้าม UPDATE/DELETE
 *
 * Postgres RULES บังคับใน migration 0008_loyalty_append_only.sql
 * (Drizzle ไม่ generate RULE ให้, ต้องใส่เอง)
 *
 * Source of truth สำหรับ loyalty balance — customer_loyalty cache
 * คำนวณจากที่นี่ + nightly reconcile cron
 *
 * type:
 *   earn           → +N points (จาก order paid)
 *   redeem         → -N points (ใช้ใน order)
 *   expire         → -N points (cron expiry job)
 *   adjust         → +/- (manual admin)
 *   refund_reverse → +/- (กลับ earn/redeem จาก refund)
 *
 * expires_at เก็บเฉพาะ type=earn — สำหรับ expiry job
 *
 * ดู ADR-016 + docs/ARCHITECTURE.md#crm--loyalty
 */
export const loyaltyLedger = pgTable(
  'loyalty_ledger',
  {
    id: id(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    programId: uuid()
      .notNull()
      .references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),

    type: text().notNull(), // earn | redeem | expire | adjust | refund_reverse
    points: integer().notNull(),
    balanceAfter: integer().notNull(), // snapshot สำหรับ debug

    reason: text().notNull(), // order_paid | signup_bonus | birthday | manual | admin_adjust
    referenceType: text(), // order | refund | manual | event
    referenceId: uuid(),

    expiresAt: timestamp({ withTimezone: true }), // เฉพาะ type=earn

    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(), // NULL = system
  },
  (t) => [
    index('loyalty_ledger_customer_created_idx').on(t.customerId, sql`${t.createdAt} desc`),
    index('loyalty_ledger_shop_type_created_idx').on(t.shopId, t.type, t.createdAt),
    index('loyalty_ledger_reference_idx').on(t.referenceType, t.referenceId),
    // expiry job lookup
    index('loyalty_ledger_expires_idx')
      .on(t.expiresAt)
      .where(sql`${t.type} = 'earn' AND ${t.expiresAt} is not null`),
  ],
)

export type LoyaltyLedger = typeof loyaltyLedger.$inferSelect
export type NewLoyaltyLedger = typeof loyaltyLedger.$inferInsert
