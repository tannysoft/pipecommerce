import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id } from './_helpers.ts'
import { inventoryItems } from './inventory-items.ts'
import { shops } from './shops.ts'

/**
 * Audit log ของทุกการเคลื่อนไหว stock — append-only ใน practice
 * (ไม่ enforce ระดับ DB เหมือน loyalty_ledger เพราะการแก้ stock manual
 * ผ่าน admin = use case ปกติ)
 *
 * delta = +/- จำนวน
 * reason = order | return | manual | restock | adjustment
 * reference_id = order_id, refund_id หรือ id อื่นที่เกี่ยวข้อง
 *
 * created_by = uuid ของ shop_members.user_id (ไม่ FK ตรงเพราะ Supabase
 * auth.users อยู่ schema อื่น — pattern เดียวกับ shop_members)
 */
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: id(),
    inventoryItemId: uuid()
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    delta: integer().notNull(),
    reason: text().notNull(), // order | return | manual | restock | adjustment
    referenceId: uuid(),
    note: text(),
    createdAt: createdAt(),
    createdBy: uuid(), // NULL ถ้า system-triggered (e.g., from order paid event)
  },
  (t) => [index('inventory_movements_item_created_idx').on(t.inventoryItemId, t.createdAt)],
)

export type InventoryMovement = typeof inventoryMovements.$inferSelect
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert
