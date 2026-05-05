import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'
import { customers } from './customers.ts'
import { shops } from './shops.ts'

/**
 * Identity provider link สำหรับ storefront customer.
 *
 * 1 customer → N identities (login ผ่าน Google + Facebook + LINE ก็ได้,
 * link เข้า account เดียวกัน). provider_user_id = NULL สำหรับ email magic link.
 *
 * UNIQUE (shop_id, provider, provider_user_id) ป้องกัน user เดียวกัน
 * link ซ้ำผ่าน provider เดียว
 */
export const customerIdentities = pgTable(
  'customer_identities',
  {
    id: id(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    provider: text().notNull(), // email | google | facebook | line
    providerUserId: text(), // sub | app-scoped id | line userId; NULL สำหรับ email
    emailAtProvider: text(), // email ที่ provider ส่งมา (อาจไม่ตรงกับ customers.email)
    displayName: text(),
    pictureUrl: text(),
    rawProfile: jsonb(),
    isPrimary: boolean().notNull().default(false),
    emailVerified: boolean().notNull().default(false),
    lastLoginAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('customer_identities_provider_unique').on(
      t.shopId,
      t.provider,
      t.providerUserId,
    ),
    index('customer_identities_customer_idx').on(t.customerId),
  ],
)

export type CustomerIdentity = typeof customerIdentities.$inferSelect
export type NewCustomerIdentity = typeof customerIdentities.$inferInsert
