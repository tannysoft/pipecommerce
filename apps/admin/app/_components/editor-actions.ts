'use server'

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { R2_BUCKET, publicImageUrl, r2 } from '@/lib/r2.ts'
import { requireShop } from '@/lib/shop.ts'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
}

const MAX_BYTES = 8 * 1024 * 1024

export type UploadEditorImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export async function uploadEditorImage(
  shopSlug: string,
  formData: FormData,
): Promise<UploadEditorImageResult> {
  const { shop } = await requireShop(shopSlug)

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'no file' }
  if (file.size === 0) return { ok: false, error: 'ไฟล์ว่าง' }
  if (file.size > MAX_BYTES) return { ok: false, error: 'ไฟล์ใหญ่เกิน 8 MB' }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return { ok: false, error: 'รองรับ jpg/png/webp/avif/gif เท่านั้น' }

  const uuid = crypto.randomUUID()
  const r2Key = `shops/${shop.id}/editor/${uuid}.${ext}`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
        Body: buffer,
        ContentType: file.type,
      }),
    )
  } catch (error) {
    console.error('[editor-upload] R2 put failed', error)
    return { ok: false, error: 'อัปโหลดไป R2 ไม่สำเร็จ — ตรวจ R2 credentials' }
  }

  try {
    return { ok: true, url: publicImageUrl(r2Key) }
  } catch (error) {
    console.error('[editor-upload] publicImageUrl failed', error)
    return { ok: false, error: 'R2_PUBLIC_URL ไม่ได้ตั้งค่า' }
  }
}
