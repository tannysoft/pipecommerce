import { sql } from 'drizzle-orm'
import { integer, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id } from './_helpers.ts'
import { locations } from './locations.ts'
import { productVariants } from './product-variants.ts'
import { shops } from './shops.ts'

/**
 * Stock counter ต่อ (variant × location)
 *
 * available = พร้อมขายให้ลูกค้า
 * committed = จองแล้ว อยู่ใน cart/pending order
 * on_hand   = available + committed (computed)
 *
 * ตอน checkout: SELECT ... FOR UPDATE row นี้ → decrement available,
 * increment committed → ตอน order paid ลด committed (เพราะของออกไปจริง)
 *
 * ดู docs/ARCHITECTURE.md#race-condition-handling
 */
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: id(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    locationId: uuid()
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    available: integer().notNull().default(0),
    committed: integer().notNull().default(0),
    onHand: integer().generatedAlwaysAs(sql`available + committed`),
  },
  (t) => [uniqueIndex('inventory_items_variant_location_unique').on(t.variantId, t.locationId)],
)

export type InventoryItem = typeof inventoryItems.$inferSelect
export type NewInventoryItem = typeof inventoryItems.$inferInsert
