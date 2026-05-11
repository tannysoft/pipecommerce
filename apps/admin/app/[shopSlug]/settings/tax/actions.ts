'use server'

import { eq } from '@pipecommerce/db'
import { shops } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

export type TaxMode = 'inclusive_customer' | 'exclusive_customer' | 'shop_absorbs' | 'none'

export type TaxSettings = {
  mode: TaxMode
  rate: number // 0..1 (e.g., 0.07 = 7%)
  label: string // e.g., "VAT 7%"
}

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function updateTaxSettings(
  shopSlug: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)

  const mode = String(formData.get('mode') ?? '') as TaxMode
  const rateInput = String(formData.get('rate') ?? '0')
  const label = String(formData.get('label') ?? '').trim() || 'Tax'

  if (!['inclusive_customer', 'exclusive_customer', 'shop_absorbs', 'none'].includes(mode)) {
    return { ok: false, error: 'mode ไม่ถูกต้อง' }
  }

  // Accept rate as percentage (e.g., "7" for 7%) or decimal (e.g., "0.07")
  const rateNum = Number(rateInput)
  if (!Number.isFinite(rateNum) || rateNum < 0) {
    return { ok: false, error: 'rate ต้องเป็นตัวเลข ≥ 0' }
  }
  const rate = rateNum > 1 ? rateNum / 100 : rateNum
  if (rate > 1) return { ok: false, error: 'rate สูงสุด 100%' }

  const settings = (shop.settings ?? {}) as Record<string, unknown>
  const next = { ...settings, tax: { mode, rate, label } satisfies TaxSettings }

  await db
    .update(shops)
    .set({ settings: next, updatedAt: new Date() })
    .where(eq(shops.id, shop.id))

  revalidatePath(`/${shopSlug}/settings/tax`)
  return { ok: true }
}
