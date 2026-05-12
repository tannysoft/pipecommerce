'use server'

import { eq } from '@pipecommerce/db'
import { shops } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { requireShop, type ShopSettings } from '@/lib/shop.ts'

export type SaveAnalyticsResult = { ok: true } | { ok: false; error: string }

const GA4_RE = /^G-[A-Z0-9]{6,15}$/i
const PIXEL_RE = /^\d{8,20}$/

export async function saveAnalyticsSettings(
  shopSlug: string,
  formData: FormData,
): Promise<SaveAnalyticsResult> {
  const { shop } = await requireShop(shopSlug)

  const ga4Raw = String(formData.get('ga4MeasurementId') ?? '').trim()
  const pixelRaw = String(formData.get('metaPixelId') ?? '').trim()

  if (ga4Raw && !GA4_RE.test(ga4Raw)) {
    return { ok: false, error: 'GA4 Measurement ID ต้องขึ้นต้น G- (เช่น G-ABC123XYZ)' }
  }
  if (pixelRaw && !PIXEL_RE.test(pixelRaw)) {
    return { ok: false, error: 'Meta Pixel ID ต้องเป็นตัวเลข 8-20 หลัก' }
  }

  const current = (shop.settings ?? {}) as ShopSettings
  const newSettings: ShopSettings = {
    ...current,
    analytics: {
      ga4MeasurementId: ga4Raw || null,
      metaPixelId: pixelRaw || null,
    },
  }

  await db
    .update(shops)
    .set({ settings: newSettings, updatedAt: new Date() })
    .where(eq(shops.id, shop.id))

  revalidatePath(`/${shopSlug}/settings/analytics`)
  return { ok: true }
}
