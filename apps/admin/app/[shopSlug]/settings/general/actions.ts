'use server'

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { eq } from '@pipecommerce/db'
import { shops } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { R2_BUCKET, publicImageUrl, r2 } from '@/lib/r2.ts'
import { requireShop } from '@/lib/shop.ts'

export type SaveProfileResult =
  | { ok: true }
  | { ok: false; error: string }

const NAME_MAX = 120
const DESCRIPTION_MAX = 500

export async function saveShopProfile(
  shopSlug: string,
  formData: FormData,
): Promise<SaveProfileResult> {
  const { shop } = await requireShop(shopSlug)

  const name = String(formData.get('name') ?? '').trim()
  const descriptionRaw = String(formData.get('description') ?? '').trim()
  const description = descriptionRaw === '' ? null : descriptionRaw

  if (!name) return { ok: false, error: 'กรุณากรอกชื่อร้าน' }
  if (name.length > NAME_MAX) {
    return { ok: false, error: `ชื่อร้านยาวเกิน ${NAME_MAX} ตัวอักษร` }
  }
  if (description && description.length > DESCRIPTION_MAX) {
    return { ok: false, error: `คำอธิบายยาวเกิน ${DESCRIPTION_MAX} ตัวอักษร` }
  }

  await db
    .update(shops)
    .set({ name, description, updatedAt: new Date() })
    .where(eq(shops.id, shop.id))

  revalidatePath(`/${shopSlug}/settings/general`)
  return { ok: true }
}

// ─── Logo upload ────────────────────────────────────────────────────────────

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}
const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB — logos ควรเล็ก

export type UploadLogoResult =
  | { ok: true; logoUrl: string }
  | { ok: false; error: string }

export async function uploadShopLogo(
  shopSlug: string,
  formData: FormData,
): Promise<UploadLogoResult> {
  const { shop } = await requireShop(shopSlug)

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'no file' }
  if (file.size === 0) return { ok: false, error: 'ไฟล์ว่าง' }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: 'ไฟล์ใหญ่เกิน 2 MB' }
  }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return { ok: false, error: 'รองรับ jpg/png/webp/svg เท่านั้น' }
  }

  // Random suffix → cache-bust ทุกครั้งที่อัปโหลดใหม่ (กัน CDN เก่าค้าง)
  const suffix = crypto.randomUUID().slice(0, 8)
  const r2Key = `shops/${shop.id}/logo-${suffix}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  const logoUrl = publicImageUrl(r2Key)

  // อ่าน key เก่าไว้ลบทีหลัง — เก็บแค่ URL ใน DB, parse กลับเป็น key
  const oldKey = parseLogoKey(shop.logoUrl)

  await db
    .update(shops)
    .set({ logoUrl, updatedAt: new Date() })
    .where(eq(shops.id, shop.id))

  if (oldKey && oldKey !== r2Key) {
    await r2
      .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey }))
      .catch(() => {}) // best-effort
  }

  revalidatePath(`/${shopSlug}/settings/general`)
  return { ok: true, logoUrl }
}

export async function removeShopLogo(shopSlug: string): Promise<{ ok: boolean }> {
  const { shop } = await requireShop(shopSlug)
  if (!shop.logoUrl) return { ok: false }

  const oldKey = parseLogoKey(shop.logoUrl)

  await db
    .update(shops)
    .set({ logoUrl: null, updatedAt: new Date() })
    .where(eq(shops.id, shop.id))

  if (oldKey) {
    await r2
      .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey }))
      .catch(() => {})
  }

  revalidatePath(`/${shopSlug}/settings/general`)
  return { ok: true }
}

function parseLogoKey(url: string | null): string | null {
  if (!url) return null
  // URL pattern: {R2_PUBLIC_URL}/shops/{shopId}/logo-{suffix}.{ext}
  const idx = url.indexOf('/shops/')
  if (idx === -1) return null
  return url.slice(idx + 1)
}
