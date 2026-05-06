'use server'

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { and, eq, sql } from '@pipecommerce/db'
import { galleries, galleryImages } from '@pipecommerce/db/schema'
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

export async function uploadGalleryImage(
  shopSlug: string,
  galleryId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const { shop } = await requireShop(shopSlug)

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'no file' }
  if (file.size === 0) return { ok: false, error: 'ไฟล์ว่าง' }
  if (file.size > MAX_BYTES) return { ok: false, error: 'ไฟล์ใหญ่เกิน 8 MB' }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return { ok: false, error: 'รองรับ jpg/png/webp/avif เท่านั้น' }

  // verify gallery ownership
  const [gallery] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.shopId, shop.id)))
    .limit(1)
  if (!gallery) return { ok: false, error: 'ไม่พบ gallery' }

  // next position = max(position) + 1 ของ gallery นี้
  const [{ nextPos }] = await db.execute<{ nextPos: number }>(
    sql`SELECT COALESCE(MAX(position), -1) + 1 AS "nextPos"
        FROM gallery_images WHERE gallery_id = ${galleryId} AND deleted_at IS NULL`,
  ) as unknown as [{ nextPos: number }]

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

  await db.insert(galleryImages).values({
    galleryId,
    shopId: shop.id,
    uuid: imageUuid,
    ext,
    r2KeyOrig: r2Key,
    bytes: file.size,
    position: Number(nextPos) || 0,
    variantsStatus: 'ready',
  })

  revalidatePath(`/${shopSlug}/galleries/${galleryId}`)
  return { ok: true }
}

export async function deleteGalleryImage(
  shopSlug: string,
  galleryId: string,
  imageId: string,
): Promise<void> {
  const { shop } = await requireShop(shopSlug)

  const [img] = await db
    .select({ id: galleryImages.id, r2KeyOrig: galleryImages.r2KeyOrig })
    .from(galleryImages)
    .where(
      and(
        eq(galleryImages.id, imageId),
        eq(galleryImages.galleryId, galleryId),
        eq(galleryImages.shopId, shop.id),
      ),
    )
    .limit(1)
  if (!img) return

  await r2
    .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: img.r2KeyOrig }))
    .catch(() => {})
  await db
    .update(galleryImages)
    .set({ deletedAt: new Date() })
    .where(eq(galleryImages.id, imageId))

  revalidatePath(`/${shopSlug}/galleries/${galleryId}`)
}
