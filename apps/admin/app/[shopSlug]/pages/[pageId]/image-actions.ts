'use server'

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { and, eq } from '@pipecommerce/db'
import { pages } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { R2_BUCKET, publicImageUrl, r2 } from '@/lib/r2.ts'
import { requireShop } from '@/lib/shop.ts'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}
const MAX_BYTES = 8 * 1024 * 1024

export type UploadResult = { ok: true; url: string } | { ok: false; error: string }

/**
 * Extract R2 key จาก public URL ที่เก็บใน DB — สำหรับ delete object เก่า
 * (R2_PUBLIC_URL/path → path)
 */
function urlToKey(url: string): string | null {
  const base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')
  if (!base || !url.startsWith(base)) return null
  return url.slice(base.length + 1)
}

export async function uploadPageFeaturedImage(
  shopSlug: string,
  pageId: string,
  formData: FormData,
): Promise<UploadResult> {
  const { shop } = await requireShop(shopSlug)

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'no file' }
  if (file.size === 0) return { ok: false, error: 'ไฟล์ว่าง' }
  if (file.size > MAX_BYTES) return { ok: false, error: 'ไฟล์ใหญ่เกิน 8 MB' }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return { ok: false, error: 'รองรับ jpg/png/webp/avif เท่านั้น' }

  const [page] = await db
    .select({ id: pages.id, oldUrl: pages.featuredImageUrl })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.shopId, shop.id)))
    .limit(1)
  if (!page) return { ok: false, error: 'ไม่พบ page' }

  const uuid = crypto.randomUUID()
  const r2Key = `shops/${shop.id}/orig/${uuid}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
        Body: buffer,
        ContentType: file.type,
      }),
    )
  } catch (error) {
    console.error('[page image] R2 put failed', error)
    return { ok: false, error: 'อัปโหลดไป R2 ไม่สำเร็จ' }
  }

  const url = publicImageUrl(r2Key)

  await db
    .update(pages)
    .set({ featuredImageUrl: url, updatedAt: new Date() })
    .where(eq(pages.id, pageId))

  // Best-effort delete old image
  if (page.oldUrl) {
    const oldKey = urlToKey(page.oldUrl)
    if (oldKey) {
      await r2
        .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey }))
        .catch(() => {})
    }
  }

  revalidatePath(`/${shopSlug}/pages/${pageId}`)
  return { ok: true, url }
}

export async function removePageFeaturedImage(
  shopSlug: string,
  pageId: string,
): Promise<{ ok: boolean }> {
  const { shop } = await requireShop(shopSlug)

  const [page] = await db
    .select({ oldUrl: pages.featuredImageUrl })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.shopId, shop.id)))
    .limit(1)
  if (!page?.oldUrl) return { ok: false }

  await db
    .update(pages)
    .set({ featuredImageUrl: null, updatedAt: new Date() })
    .where(eq(pages.id, pageId))

  const oldKey = urlToKey(page.oldUrl)
  if (oldKey) {
    await r2
      .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey }))
      .catch(() => {})
  }

  revalidatePath(`/${shopSlug}/pages/${pageId}`)
  return { ok: true }
}
