'use server'

import { eq } from '@pipecommerce/db'
import { shopAnnouncementBars } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function saveAnnouncementBar(
  shopSlug: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)

  const text = String(formData.get('text') ?? '').trim()
  const link = String(formData.get('link') ?? '').trim() || null
  const linkText = String(formData.get('linkText') ?? '').trim() || null
  const isActive = formData.get('isActive') === 'on'
  const isDismissible = formData.get('isDismissible') === 'on'
  const backgroundColor = String(formData.get('backgroundColor') ?? '').trim() || null
  const textColor = String(formData.get('textColor') ?? '').trim() || null

  if (isActive && !text) {
    return { ok: false, error: 'กรุณากรอกข้อความเมื่อเปิด announcement bar' }
  }

  const messages = text ? [{ text, link, link_text: linkText }] : []

  const [existing] = await db
    .select({ id: shopAnnouncementBars.id })
    .from(shopAnnouncementBars)
    .where(eq(shopAnnouncementBars.shopId, shop.id))
    .limit(1)

  if (existing) {
    await db
      .update(shopAnnouncementBars)
      .set({
        isActive,
        isDismissible,
        messages,
        backgroundColor,
        textColor,
        updatedAt: new Date(),
      })
      .where(eq(shopAnnouncementBars.id, existing.id))
  } else {
    await db.insert(shopAnnouncementBars).values({
      shopId: shop.id,
      isActive,
      isDismissible,
      messages,
      backgroundColor,
      textColor,
      showOn: 'all',
    })
  }

  revalidatePath(`/${shopSlug}/settings/announcement-bar`)
  return { ok: true }
}
