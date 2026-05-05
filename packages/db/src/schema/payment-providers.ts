import { boolean, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Per-shop payment provider config
 *
 * vault_secret_id = reference ใน Supabase Vault (เก็บ API key ของ Beam)
 * Beam ไม่มี marketplace API → แต่ละร้านมี merchant account ของตัวเอง
 *
 * ดู ADR-003 (Beamcheckout) + ADR-004 (subscription monetization)
 */
export const paymentProviders = pgTable(
  'payment_providers',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    provider: text().notNull(), // beam (อนาคต: stripe, omise)
    vaultSecretId: text().notNull(), // ref ไปที่ Supabase Vault
    isEnabled: boolean().notNull().default(true),
    isTestMode: boolean().notNull().default(false),
    config: jsonb(), // non-secret config
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('payment_providers_shop_provider_unique').on(t.shopId, t.provider)],
)

export type PaymentProvider = typeof paymentProviders.$inferSelect
export type NewPaymentProvider = typeof paymentProviders.$inferInsert
