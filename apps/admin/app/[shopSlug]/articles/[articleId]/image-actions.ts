'use server'

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { and, eq } from '@pipecommerce/db'
import { articleImages, articles } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { R2_BUCKET, r2 } from '@/lib/r2.ts'
import { requireShop } from '@/lib/shop.ts'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

const MAX_BYTES = 8 * 1024 * 1024

export type UploadResult = { ok: true; imageId: string } | { ok: false; error: string }

export async function uploadArticleFeaturedImage(
  shopSlug: string,
  articleId: string,
  formData: FormData,
): Promise<UploadResult> {
  const { shop } = await requireShop(shopSlug)

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'no file' }
  if (file.size === 0) return { ok: false, error: 'ไฟล์ว่าง' }
  if (file.size > MAX_BYTES) return { ok: false, error: 'ไฟล์ใหญ่เกิน 8 MB' }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return { ok: false, error: 'รองรับ jpg/png/webp/avif เท่านั้น' }

  const [article] = await db
    .select({ id: articles.id, oldImageId: articles.featuredImageId })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.shopId, shop.id)))
    .limit(1)
  if (!article) return { ok: false, error: 'ไม่พบบทความ' }

  const imageUuid = crypto.randomUUID()
  const r2Key = `shops/${shop.id}/orig/${imageUuid}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: buffer,
      ContentType: file.type,
    }),
  )

  const [inserted] = await db
    .insert(articleImages)
    .values({
      articleId,
      shopId: shop.id,
      uuid: imageUuid,
      ext,
      r2KeyOrig: r2Key,
      bytes: file.size,
      variantsStatus: 'ready',
    })
    .returning({ id: articleImages.id })

  await db
    .update(articles)
    .set({ featuredImageId: inserted!.id, updatedAt: new Date() })
    .where(eq(articles.id, articleId))

  // ลบรูปเก่า ถ้ามี (best-effort)
  if (article.oldImageId) {
    const [old] = await db
      .select({ id: articleImages.id, r2KeyOrig: articleImages.r2KeyOrig })
      .from(articleImages)
      .where(eq(articleImages.id, article.oldImageId))
      .limit(1)
    if (old) {
      await r2
        .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: old.r2KeyOrig }))
        .catch(() => {})
      await db
        .update(articleImages)
        .set({ deletedAt: new Date() })
        .where(eq(articleImages.id, old.id))
    }
  }

  revalidatePath(`/${shopSlug}/articles/${articleId}`)
  return { ok: true, imageId: inserted!.id }
}

export async function removeArticleFeaturedImage(
  shopSlug: string,
  articleId: string,
): Promise<{ ok: boolean }> {
  const { shop } = await requireShop(shopSlug)

  const [article] = await db
    .select({ oldImageId: articles.featuredImageId })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.shopId, shop.id)))
    .limit(1)
  if (!article?.oldImageId) return { ok: false }

  const [old] = await db
    .select({ id: articleImages.id, r2KeyOrig: articleImages.r2KeyOrig })
    .from(articleImages)
    .where(eq(articleImages.id, article.oldImageId))
    .limit(1)

  await db
    .update(articles)
    .set({ featuredImageId: null, updatedAt: new Date() })
    .where(eq(articles.id, articleId))

  if (old) {
    await r2
      .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: old.r2KeyOrig }))
      .catch(() => {})
    await db
      .update(articleImages)
      .set({ deletedAt: new Date() })
      .where(eq(articleImages.id, old.id))
  }

  revalidatePath(`/${shopSlug}/articles/${articleId}`)
  return { ok: true }
}
