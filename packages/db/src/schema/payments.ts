import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { orders } from './orders.ts'
import { shops } from './shops.ts'

/**
 * Payment record — สร้างเมื่อรับ webhook จาก Beam
 *
 * status flow: pending → succeeded | failed | cancelled | refunded
 * raw_response เก็บ payload ดิบจาก Beam ไว้ debug + reconcile
 *
 * 1 order มีได้หลาย payment (retry หรือ partial payment)
 */
export const payments = pgTable(
  'payments',
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    provider: text().notNull(), // beam | ...
    providerChargeId: text(), // id ฝั่ง Beam
    paymentLinkId: text(), // Beam payment link id
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    status: text().notNull(), // pending | succeeded | failed | refunded | cancelled
    paymentMethod: text(), // card | promptpay | mobile_banking | ...
    failureReason: text(),
    rawResponse: jsonb(),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('payments_provider_charge_idx').on(t.providerChargeId),
    index('payments_order_idx').on(t.orderId),
  ],
)

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
