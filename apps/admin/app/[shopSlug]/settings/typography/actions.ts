'use server'

import { eq, sql } from '@pipecommerce/db'
import { shops } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { ADMIN_FONT_KEYS } from '@/lib/fonts.ts'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

export type TypographyResult = { ok: true } | { ok: false; error: string }

export async function updateShopFonts(
  shopSlug: string,
  formData: FormData,
): Promise<TypographyResult> {
  const { shop } = await requireShop(shopSlug)

  const heading = String(formData.get('heading') ?? '')
  const body = String(formData.get('body') ?? '')

  if (!ADMIN_FONT_KEYS.has(heading)) return { ok: false, error: 'heading font ไม่อยู่ใน list' }
  if (!ADMIN_FONT_KEYS.has(body)) return { ok: false, error: 'body font ไม่อยู่ใน list' }

  // jsonb merge: settings = COALESCE(settings, '{}') || { fonts: {...} }
  const fontsPatch = JSON.stringify({ fonts: { heading, body } })

  await db
    .update(shops)
    .set({
      settings: sql`COALESCE(${shops.settings}, '{}'::jsonb) || ${fontsPatch}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(shops.id, shop.id))

  revalidatePath(`/${shopSlug}/settings/typography`)
  // storefront cache จะ refresh ที่ next request — ไม่ต้องแตะที่นี่
  return { ok: true }
}
