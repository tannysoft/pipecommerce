'use server'

import { eq } from '@pipecommerce/db'
import { shops } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { requireShop, type ShopMenuItem, type ShopSettings } from '@/lib/shop.ts'

const MAX_ITEMS = 12
const LABEL_MAX = 40
const HREF_MAX = 200

export type SaveMenuResult = { ok: true } | { ok: false; error: string }

function validateItem(item: unknown, idx: number): ShopMenuItem | string {
  if (!item || typeof item !== 'object') return `รายการที่ ${idx + 1} ไม่ถูกต้อง`
  const label = String((item as Record<string, unknown>).label ?? '').trim()
  const href = String((item as Record<string, unknown>).href ?? '').trim()
  if (!label) return `รายการที่ ${idx + 1}: กรุณากรอกชื่อ`
  if (label.length > LABEL_MAX) return `รายการที่ ${idx + 1}: ชื่อยาวเกิน ${LABEL_MAX} ตัวอักษร`
  if (!href) return `รายการที่ ${idx + 1}: กรุณากรอกลิงก์`
  if (href.length > HREF_MAX) return `รายการที่ ${idx + 1}: ลิงก์ยาวเกิน ${HREF_MAX} ตัวอักษร`
  // อนุญาต relative (/products, /collections/x) หรือ absolute (https://...)
  if (!href.startsWith('/') && !href.startsWith('http://') && !href.startsWith('https://')) {
    return `รายการที่ ${idx + 1}: ลิงก์ต้องขึ้นต้นด้วย / หรือ http(s)://`
  }
  return { label, href }
}

export async function saveShopMenu(
  shopSlug: string,
  rawItems: unknown[],
): Promise<SaveMenuResult> {
  const { shop } = await requireShop(shopSlug)

  if (!Array.isArray(rawItems)) return { ok: false, error: 'invalid input' }
  if (rawItems.length > MAX_ITEMS) {
    return { ok: false, error: `เพิ่มได้สูงสุด ${MAX_ITEMS} รายการ` }
  }

  const validated: ShopMenuItem[] = []
  for (let i = 0; i < rawItems.length; i++) {
    const result = validateItem(rawItems[i], i)
    if (typeof result === 'string') return { ok: false, error: result }
    validated.push(result)
  }

  const currentSettings = (shop.settings ?? {}) as ShopSettings
  const newSettings: ShopSettings = { ...currentSettings, menu: validated }

  await db
    .update(shops)
    .set({ settings: newSettings, updatedAt: new Date() })
    .where(eq(shops.id, shop.id))

  revalidatePath(`/${shopSlug}/settings/menu`)
  return { ok: true }
}
