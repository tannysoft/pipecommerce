'use server'

import { and, eq, isNull, ne } from '@pipecommerce/db'
import { pages } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export type PageResult = { ok: true } | { ok: false; error: string }

function readForm(formData: FormData) {
  return {
    title: String(formData.get('title') ?? '').trim(),
    handle: String(formData.get('handle') ?? '').trim().toLowerCase(),
    body: String(formData.get('body') ?? '').trim() || null,
    status: String(formData.get('status') ?? 'draft'),
    seoTitle: String(formData.get('seoTitle') ?? '').trim() || null,
    seoDescription: String(formData.get('seoDescription') ?? '').trim() || null,
    featuredImageUrl: String(formData.get('featuredImageUrl') ?? '').trim() || null,
  }
}

function validate(input: ReturnType<typeof readForm>): PageResult {
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

export async function createPage(shopSlug: string, formData: FormData): Promise<PageResult> {
  const { shop } = await requireShop(shopSlug)
  const input = readForm(formData)
  const v = validate(input)
  if (!v.ok) return v

  let createdId: string
  try {
    const [created] = await db
      .insert(pages)
      .values({
        shopId: shop.id,
        title: input.title,
        handle: input.handle,
        body: input.body,
        status: input.status,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        featuredImageUrl: input.featuredImageUrl,
        publishedAt: input.status === 'active' ? new Date() : null,
      })
      .returning({ id: pages.id })
    if (!created) throw new Error('insert page failed')
    createdId = created.id
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'handle นี้มีอีก page ใช้แล้ว' }
    }
    throw error
  }

  redirect(`/${shopSlug}/pages/${createdId}`)
}

export async function updatePage(
  shopSlug: string,
  pageId: string,
  formData: FormData,
): Promise<PageResult> {
  const { shop } = await requireShop(shopSlug)
  const input = readForm(formData)
  const v = validate(input)
  if (!v.ok) return v

  const [existing] = await db
    .select({ id: pages.id, currentStatus: pages.status })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.shopId, shop.id), isNull(pages.deletedAt)))
    .limit(1)
  if (!existing) return { ok: false, error: 'ไม่พบ page' }

  const [duplicate] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(
      and(
        eq(pages.shopId, shop.id),
        eq(pages.handle, input.handle),
        ne(pages.id, pageId),
      ),
    )
    .limit(1)
  if (duplicate) return { ok: false, error: 'handle นี้มีอีก page ใช้แล้ว' }

  try {
    await db
      .update(pages)
      .set({
        title: input.title,
        handle: input.handle,
        body: input.body,
        status: input.status,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        publishedAt:
          input.status === 'active' && existing.currentStatus !== 'active'
            ? new Date()
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, pageId))
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'handle ซ้ำ' }
    }
    throw error
  }

  revalidatePath(`/${shopSlug}/pages`)
  revalidatePath(`/${shopSlug}/pages/${pageId}`)
  return { ok: true }
}

export async function deletePage(shopSlug: string, pageId: string) {
  const { shop } = await requireShop(shopSlug)
  await db
    .update(pages)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(pages.id, pageId), eq(pages.shopId, shop.id)))

  revalidatePath(`/${shopSlug}/pages`)
  redirect(`/${shopSlug}/pages`)
}
