'use server'

import { and, eq, isNull, ne } from '@pipecommerce/db'
import { galleries } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export type GalleryResult = { ok: true } | { ok: false; error: string }

function readForm(formData: FormData) {
  return {
    title: String(formData.get('title') ?? '').trim(),
    handle: String(formData.get('handle') ?? '').trim().toLowerCase(),
    description: String(formData.get('description') ?? '').trim() || null,
    status: String(formData.get('status') ?? 'draft'),
    seoTitle: String(formData.get('seoTitle') ?? '').trim() || null,
    seoDescription: String(formData.get('seoDescription') ?? '').trim() || null,
  }
}

function validate(input: ReturnType<typeof readForm>): GalleryResult {
  if (!input.title) return { ok: false, error: 'กรุณากรอก title' }
  if (input.handle.length < 1 || input.handle.length > 60) {
    return { ok: false, error: 'handle ต้องยาว 1-60 ตัว' }
  }
  if (!HANDLE_PATTERN.test(input.handle)) {
    return { ok: false, error: 'handle ใช้ได้เฉพาะ a-z, 0-9, -' }
  }
  if (!['draft', 'active', 'archived'].includes(input.status)) {
    return { ok: false, error: 'status ไม่ถูกต้อง' }
  }
  return { ok: true }
}

export async function createGallery(
  shopSlug: string,
  formData: FormData,
): Promise<GalleryResult> {
  const { shop } = await requireShop(shopSlug)
  const input = readForm(formData)
  const v = validate(input)
  if (!v.ok) return v

  let createdId: string
  try {
    const [created] = await db
      .insert(galleries)
      .values({
        shopId: shop.id,
        title: input.title,
        handle: input.handle,
        description: input.description,
        status: input.status,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        publishedAt: input.status === 'active' ? new Date() : null,
      })
      .returning({ id: galleries.id })
    if (!created) throw new Error('insert gallery failed')
    createdId = created.id
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'handle ซ้ำ' }
    }
    throw error
  }

  redirect(`/${shopSlug}/galleries/${createdId}`)
}

export async function updateGallery(
  shopSlug: string,
  galleryId: string,
  formData: FormData,
): Promise<GalleryResult> {
  const { shop } = await requireShop(shopSlug)
  const input = readForm(formData)
  const v = validate(input)
  if (!v.ok) return v

  const [existing] = await db
    .select({ id: galleries.id, currentStatus: galleries.status })
    .from(galleries)
    .where(
      and(
        eq(galleries.id, galleryId),
        eq(galleries.shopId, shop.id),
        isNull(galleries.deletedAt),
      ),
    )
    .limit(1)
  if (!existing) return { ok: false, error: 'ไม่พบ gallery' }

  const [duplicate] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(
      and(
        eq(galleries.shopId, shop.id),
        eq(galleries.handle, input.handle),
        ne(galleries.id, galleryId),
      ),
    )
    .limit(1)
  if (duplicate) return { ok: false, error: 'handle ซ้ำ' }

  try {
    await db
      .update(galleries)
      .set({
        title: input.title,
        handle: input.handle,
        description: input.description,
        status: input.status,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        publishedAt:
          input.status === 'active' && existing.currentStatus !== 'active'
            ? new Date()
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(galleries.id, galleryId))
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'handle ซ้ำ' }
    }
    throw error
  }

  revalidatePath(`/${shopSlug}/galleries`)
  revalidatePath(`/${shopSlug}/galleries/${galleryId}`)
  return { ok: true }
}

export async function deleteGallery(shopSlug: string, galleryId: string) {
  const { shop } = await requireShop(shopSlug)
  await db
    .update(galleries)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(galleries.id, galleryId), eq(galleries.shopId, shop.id)))

  revalidatePath(`/${shopSlug}/galleries`)
  redirect(`/${shopSlug}/galleries`)
}
