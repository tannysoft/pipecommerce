'use server'

import { eq } from '@pipecommerce/db'
import { shops } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

export type ShippingSettings = {
  defaultRate: number // ฿ ต่อออเดอร์ (0 = free)
  freeThreshold: number | null // ถ้า subtotal >= threshold → ฟรี
}

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function updateShippingSettings(
  shopSlug: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)

  const rate = Number(formData.get('defaultRate') ?? '0')
  const thresholdRaw = String(formData.get('freeThreshold') ?? '').trim()

  if (!Number.isFinite(rate) || rate < 0) {
    return { ok: false, error: 'ค่าส่งต้องเป็นตัวเลข ≥ 0' }
  }

  let threshold: number | null = null
  if (thresholdRaw !== '') {
    const t = Number(thresholdRaw)
    if (!Number.isFinite(t) || t < 0) {
      return { ok: false, error: 'free threshold ต้องเป็นตัวเลข ≥ 0' }
    }
    threshold = t
  }

  const settings = (shop.settings ?? {}) as Record<string, unknown>
  const next = {
    ...settings,
    shipping: { defaultRate: rate, freeThreshold: threshold } satisfies ShippingSettings,
  }

  await db
    .update(shops)
    .set({ settings: next, updatedAt: new Date() })
    .where(eq(shops.id, shop.id))

  revalidatePath(`/${shopSlug}/settings/shipping`)
  return { ok: true }
}
