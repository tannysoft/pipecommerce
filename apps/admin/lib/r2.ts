import { S3Client } from '@aws-sdk/client-s3'

/**
 * R2 client (S3-compatible) — lazy-init proxy
 *
 * R2 endpoint pattern: https://{account_id}.r2.cloudflarestorage.com
 * Region = 'auto' (R2 ไม่มี region แต่ AWS SDK บังคับ)
 *
 * ใน production บน CF Workers จะใช้ R2 binding (env.R2.put/.get) ตรงๆ
 * ไม่ต้องผ่าน S3 API. ตอนนี้ next dev → ใช้ S3 endpoint
 *
 * Lazy init = กัน build error ตอน Next.js collect page data ถ้า env ไม่มี
 * Error จะ throw ตอน .send() แทน (runtime, ไม่ใช่ import)
 */
declare global {
  // eslint-disable-next-line no-var
  var _pcR2: S3Client | undefined
}

function buildClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 credentials missing — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY',
    )
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function getClient(): S3Client {
  if (globalThis._pcR2) return globalThis._pcR2
  const client = buildClient()
  if (process.env.NODE_ENV !== 'production') globalThis._pcR2 = client
  return client
}

/**
 * Lazy-init proxy — getter ทุกอันสร้าง client ตอนแรกใช้งาน
 * ที่จำเป็น: .send() (call ใน R2 actions)
 */
export const r2 = new Proxy({} as S3Client, {
  get(_target, prop, receiver) {
    const client = getClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export const R2_BUCKET = process.env.R2_BUCKET ?? 'pipecommerce'

/**
 * Build public URL ของ object ใน R2 (สำหรับ <img src=...>)
 */
export function publicImageUrl(r2Key: string): string {
  const base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')
  if (!base) throw new Error('R2_PUBLIC_URL is not set')
  return `${base}/${r2Key}`
}
