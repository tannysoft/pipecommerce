'use server'

import { eq } from '@pipecommerce/db'
import { shopThemeSettings } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { type HomeTemplate, type Section } from './sections.ts'
import { getOrInitTheme } from './theme-data.ts'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function saveDraftSections(
  shopSlug: string,
  sections: Section[],
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)
  await getOrInitTheme(shopSlug)

  if (!Array.isArray(sections) || sections.length > 50) {
    return { ok: false, error: 'sections ต้องเป็น array (สูงสุด 50)' }
  }

  const validTypes = new Set([
    'hero',
    'featuredProducts',
    'featuredCollections',
    'textBlock',
    'imageBanner',
  ])
  for (const s of sections) {
    if (!s || typeof s !== 'object') return { ok: false, error: 'section invalid' }
    if (!s.id || !s.type || !validTypes.has(s.type)) {
      return { ok: false, error: 'section schema ไม่ถูกต้อง' }
    }
  }

  const draftTemplates: { home: HomeTemplate } = { home: { sections } }

  await db
    .update(shopThemeSettings)
    .set({
      draftTemplates,
      draftUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(shopThemeSettings.shopId, shop.id))

  revalidatePath(`/${shopSlug}/theme/home`)
  return { ok: true }
}

export async function publishDraft(shopSlug: string): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)
  const [row] = await db
    .select()
    .from(shopThemeSettings)
    .where(eq(shopThemeSettings.shopId, shop.id))
    .limit(1)

  if (!row || !row.draftTemplates) {
    return { ok: false, error: 'ไม่มี draft ที่จะ publish' }
  }

  await db
    .update(shopThemeSettings)
    .set({
      templates: row.draftTemplates,
      publishedAt: new Date(),
      draftTemplates: null,
      draftUpdatedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(shopThemeSettings.shopId, shop.id))

  revalidatePath(`/${shopSlug}/theme/home`)
  return { ok: true }
}

export async function discardDraft(shopSlug: string): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)
  await db
    .update(shopThemeSettings)
    .set({
      draftTemplates: null,
      draftUpdatedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(shopThemeSettings.shopId, shop.id))

  revalidatePath(`/${shopSlug}/theme/home`)
  return { ok: true }
}
