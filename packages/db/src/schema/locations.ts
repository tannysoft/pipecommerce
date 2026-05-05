import { boolean, jsonb, pgTable, uuid, text } from 'drizzle-orm/pg-core'
import { createdAt, id } from './_helpers.ts'
import { shops } from './shops.ts'

/**
 * Inventory location ของร้าน — คลังหลัก, สาขา, dropship vendor, ฯลฯ
 *
 * is_default = location ที่ใช้ตอนสร้าง variant ใหม่ถ้าไม่ระบุ
 * (มี 1 row per shop ที่ is_default = true)
 */
export const locations = pgTable('locations', {
  id: id(),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  address: jsonb(), // { address1, address2, city, province, postal_code, country }
  isDefault: boolean().notNull().default(false),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
})

export type Location = typeof locations.$inferSelect
export type NewLocation = typeof locations.$inferInsert
