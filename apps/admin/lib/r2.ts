import { S3Client } from '@aws-sdk/client-s3'

/**
 * R2 client (S3-compatible)
 *
 * R2 endpoint pattern: https://{account_id}.r2.cloudflarestorage.com
 * Region = 'auto' (R2 ไม่มี region แต่ AWS SDK บังคับ)
 *
 * ใน production บน CF Workers จะใช้ R2 binding (env.R2.put/.get) ตรงๆ
 * ไม่ต้องผ่าน S3 API. ตอนนี้ next dev → ใช้ S3 endpoint
 */
declare global {
  // eslint-disable-next-line no-var
  var _pcR2: S3Client | undefined
}

function buildClient() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials missing — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY')
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export const r2: S3Client = globalThis._pcR2 ?? buildClient()
if (process.env.NODE_ENV !== 'production') globalThis._pcR2 = r2

export const R2_BUCKET = process.env.R2_BUCKET ?? 'pipecommerce'
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')

/**
 * Build public URL ของ object ใน R2 (สำหรับ <img src=...>)
 */
export function publicImageUrl(r2Key: string): string {
  if (!R2_PUBLIC_URL) throw new Error('R2_PUBLIC_URL is not set')
  return `${R2_PUBLIC_URL}/${r2Key}`
}
