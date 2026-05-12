import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { eq } from '@pipecommerce/db'
import { productImages } from '@pipecommerce/db/schema'
import sharp from 'sharp'
import { db } from '../../lib/db.ts'
import type { ImageProcessJob } from '../../lib/queue.ts'
import { R2_BUCKET, r2 } from '../../lib/r2.ts'

/**
 * Image variants — 3 sizes สำหรับ responsive serve
 *   low:  400px (thumbnail / list)
 *   mid:  800px (storefront cards)
 *   high: 1600px (product detail zoom)
 * เก็บเป็น WebP — 75% quality, cover fit
 */
const VARIANTS = [
  { name: 'low', size: 400 },
  { name: 'mid', size: 800 },
  { name: 'high', size: 1600 },
] as const

export async function processImageJob(job: ImageProcessJob) {
  const { imageId, r2Key, shopId } = job

  // Mark processing
  await db
    .update(productImages)
    .set({ variantsStatus: 'processing' })
    .where(eq(productImages.id, imageId))

  try {
    // Download original from R2
    const obj = await r2.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2Key }),
    )
    const bytes = await obj.Body!.transformToByteArray()

    // Read metadata
    const meta = await sharp(bytes).metadata()

    // Resize each variant in parallel
    await Promise.all(
      VARIANTS.map(async (v) => {
        const out = await sharp(bytes)
          .resize(v.size, v.size, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer()
        // Variant path mirrors orig path but under /img/{uuid}/{variant}.webp
        const variantKey = r2Key
          .replace(/\/orig\//, '/img/')
          .replace(/\.[^.]+$/, `/${v.name}.webp`)
        await r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: variantKey,
            Body: out,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        )
      }),
    )

    await db
      .update(productImages)
      .set({
        variantsStatus: 'ready',
        width: meta.width ?? null,
        height: meta.height ?? null,
        variantsError: null,
        updatedAt: new Date(),
      })
      .where(eq(productImages.id, imageId))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db
      .update(productImages)
      .set({
        variantsStatus: 'failed',
        variantsError: msg.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(productImages.id, imageId))
    throw err
  }

  // Touch shopId to keep parameter usage
  void shopId
}
