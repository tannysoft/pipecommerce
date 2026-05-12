'use server'

import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { and, asc, eq, isNull } from '@pipecommerce/db'
import { productImages, products } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { getQueue, QUEUES } from '@/lib/queue.ts'
import { r2, R2_BUCKET } from '@/lib/r2.ts'
import { requireShop } from '@/lib/shop.ts'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB — server action body limit ตั้งไว้ 10mb

export type UploadImageResult = { ok: true; imageId: string } | { ok: false; error: string }

export async function uploadProductImage(
  shopSlug: string,
  productId: string,
  formData: FormData,
): Promise<UploadImageResult> {
  const { shop } = await requireShop(shopSlug)

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'no file' }
  if (file.size === 0) return { ok: false, error: 'ไฟล์ว่าง' }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `ไฟล์ใหญ่เกิน ${MAX_BYTES / 1024 / 1024} MB` }
  }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return { ok: false, error: `รองรับเฉพาะ ${Object.keys(ALLOWED_TYPES).join(', ')}` }

  // verify product belong shop
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.shopId, shop.id)))
    .limit(1)
  if (!product) return { ok: false, error: 'ไม่พบสินค้า' }

  // Append ที่ position ถัดไป — รูปแรกได้ position 0 (= cover)
  const positions = await db
    .select({ position: productImages.position })
    .from(productImages)
    .where(
      and(eq(productImages.productId, productId), isNull(productImages.deletedAt)),
    )
  const nextPosition = positions.length
    ? Math.max(...positions.map((p) => p.position)) + 1
    : 0

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

  // Insert ที่สถานะ pending — worker จะ generate variants async
  // ถ้า pg-boss ยังไม่ start ก็ fallback เป็น ready (serve original)
  const [inserted] = await db
    .insert(productImages)
    .values({
      productId,
      shopId: shop.id,
      uuid: imageUuid,
      ext,
      r2KeyOrig: r2Key,
      bytes: file.size,
      position: nextPosition,
      variantsStatus: 'pending',
    })
    .returning({ id: productImages.id })

  // Enqueue image-process job — fail-safe ถ้า queue ไม่ available
  try {
    const boss = await getQueue()
    await boss.send(QUEUES.imageProcess, {
      imageId: inserted!.id,
      r2Key,
      shopId: shop.id,
    })
  } catch (err) {
    console.error('[image-actions] enqueue failed, falling back to ready:', err)
    await db
      .update(productImages)
      .set({ variantsStatus: 'ready' })
      .where(eq(productImages.id, inserted!.id))
  }

  revalidatePath(`/${shopSlug}/products/${productId}`)
  return { ok: true, imageId: inserted!.id }
}

export async function deleteProductImage(
  shopSlug: string,
  productId: string,
  imageId: string,
): Promise<{ ok: boolean }> {
  const { shop } = await requireShop(shopSlug)

  const [image] = await db
    .select({ id: productImages.id, r2KeyOrig: productImages.r2KeyOrig })
    .from(productImages)
    .where(
      and(
        eq(productImages.id, imageId),
        eq(productImages.productId, productId),
        eq(productImages.shopId, shop.id),
      ),
    )
    .limit(1)
  if (!image) return { ok: false }

  // Soft delete in DB; R2 cleanup ทำได้ตรงๆ ตอนนี้ก่อน — ถ้ามี cron ค่อยย้ายไป
  await r2
    .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: image.r2KeyOrig }))
    .catch(() => {
      /* swallow R2 not-found, DB ยัง mark deleted */
    })
  await db
    .update(productImages)
    .set({ deletedAt: new Date() })
    .where(eq(productImages.id, imageId))

  revalidatePath(`/${shopSlug}/products/${productId}`)
  return { ok: true }
}

/**
 * Reorder รูปทั้งหมดด้วย array ของ imageIds — เรียงตามลำดับใน array
 * ใช้ตอน drag-end หรือ up/down-arrow press
 */
export async function reorderProductImages(
  shopSlug: string,
  productId: string,
  imageIds: string[],
): Promise<{ ok: boolean }> {
  const { shop } = await requireShop(shopSlug)

  // verify ทุก image อยู่ใน product/shop จริง
  const existing = await db
    .select({ id: productImages.id })
    .from(productImages)
    .where(
      and(
        eq(productImages.productId, productId),
        eq(productImages.shopId, shop.id),
        isNull(productImages.deletedAt),
      ),
    )
    .orderBy(asc(productImages.position))
  const validIds = new Set(existing.map((r) => r.id))
  if (imageIds.some((id) => !validIds.has(id))) return { ok: false }
  if (imageIds.length !== existing.length) return { ok: false }

  await db.transaction(async (tx) => {
    for (let i = 0; i < imageIds.length; i++) {
      await tx
        .update(productImages)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(productImages.id, imageIds[i]!))
    }
  })

  revalidatePath(`/${shopSlug}/products/${productId}`)
  return { ok: true }
}
