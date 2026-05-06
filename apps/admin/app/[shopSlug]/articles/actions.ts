'use server'

import { and, eq, isNull, ne } from '@pipecommerce/db'
import { articles } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export type ArticleResult = { ok: true } | { ok: false; error: string }

function parseTags(raw: string): string[] {
  if (!raw) return []
  const list = raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .filter((t) => t.length <= 50)
  return [...new Set(list)].slice(0, 20)
}

function readForm(formData: FormData) {
  return {
    title: String(formData.get('title') ?? '').trim(),
    handle: String(formData.get('handle') ?? '').trim().toLowerCase(),
    body: String(formData.get('body') ?? '').trim() || null,
    excerpt: String(formData.get('excerpt') ?? '').trim() || null,
    authorName: String(formData.get('authorName') ?? '').trim() || null,
    status: String(formData.get('status') ?? 'draft'),
    tags: parseTags(String(formData.get('tags') ?? '')),
    seoTitle: String(formData.get('seoTitle') ?? '').trim() || null,
    seoDescription: String(formData.get('seoDescription') ?? '').trim() || null,
  }
}

function validate(input: ReturnType<typeof readForm>): ArticleResult {
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

export async function createArticle(
  shopSlug: string,
  formData: FormData,
): Promise<ArticleResult> {
  const { shop, user } = await requireShop(shopSlug)
  const input = readForm(formData)
  const v = validate(input)
  if (!v.ok) return v

  let createdId: string
  try {
    const [created] = await db
      .insert(articles)
      .values({
        shopId: shop.id,
        title: input.title,
        handle: input.handle,
        body: input.body,
        excerpt: input.excerpt,
        authorUserId: user.id,
        authorName: input.authorName ?? user.email ?? null,
        status: input.status,
        tags: input.tags,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        publishedAt: input.status === 'active' ? new Date() : null,
      })
      .returning({ id: articles.id })
    if (!created) throw new Error('insert article failed')
    createdId = created.id
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'handle นี้มีอีกบทความใช้แล้ว' }
    }
    throw error
  }

  redirect(`/${shopSlug}/articles/${createdId}`)
}

export async function updateArticle(
  shopSlug: string,
  articleId: string,
  formData: FormData,
): Promise<ArticleResult> {
  const { shop } = await requireShop(shopSlug)
  const input = readForm(formData)
  const v = validate(input)
  if (!v.ok) return v

  const [existing] = await db
    .select({ id: articles.id, currentStatus: articles.status })
    .from(articles)
    .where(
      and(eq(articles.id, articleId), eq(articles.shopId, shop.id), isNull(articles.deletedAt)),
    )
    .limit(1)
  if (!existing) return { ok: false, error: 'ไม่พบบทความ' }

  const [duplicate] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(
        eq(articles.shopId, shop.id),
        eq(articles.handle, input.handle),
        ne(articles.id, articleId),
      ),
    )
    .limit(1)
  if (duplicate) return { ok: false, error: 'handle ซ้ำ' }

  try {
    await db
      .update(articles)
      .set({
        title: input.title,
        handle: input.handle,
        body: input.body,
        excerpt: input.excerpt,
        authorName: input.authorName,
        status: input.status,
        tags: input.tags,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        publishedAt:
          input.status === 'active' && existing.currentStatus !== 'active'
            ? new Date()
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'handle ซ้ำ' }
    }
    throw error
  }

  revalidatePath(`/${shopSlug}/articles`)
  revalidatePath(`/${shopSlug}/articles/${articleId}`)
  return { ok: true }
}

export async function deleteArticle(shopSlug: string, articleId: string) {
  const { shop } = await requireShop(shopSlug)
  await db
    .update(articles)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(articles.id, articleId), eq(articles.shopId, shop.id)))

  revalidatePath(`/${shopSlug}/articles`)
  redirect(`/${shopSlug}/articles`)
}
