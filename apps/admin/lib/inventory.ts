import { and, eq } from '@pipecommerce/db'
import { locations } from '@pipecommerce/db/schema'
import { db } from './db.ts'

/**
 * Lazy-init default inventory location สำหรับ shop
 *
 * 1 shop = 1 default location (is_default = true)
 * ไม่ enforce ระดับ DB unique เพื่อความยืดหยุ่น (P2: multi-location)
 */
export async function getOrCreateDefaultLocation(shopId: string): Promise<string> {
  const [existing] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.shopId, shopId), eq(locations.isDefault, true)))
    .limit(1)
  if (existing) return existing.id

  const [created] = await db
    .insert(locations)
    .values({ shopId, name: 'คลังหลัก', isDefault: true, isActive: true })
    .returning({ id: locations.id })
  return created!.id
}
