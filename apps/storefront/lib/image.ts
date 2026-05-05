/**
 * Build public URL ของ R2 object สำหรับ <img src=...>
 *
 * R2_PUBLIC_URL = R2 dev subdomain หรือ custom domain (cdn.yourapp.com)
 * Variant: ตอนนี้ใช้ original ตรงๆ — Phase ถัดไปเมื่อมี queue worker
 *          จะ generate low/mid/high แล้ว URL pattern จะเปลี่ยนเป็น
 *          shops/{shop_id}/img/{uuid}/{low|mid|high}.webp
 */
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')

export function publicImageUrl(r2Key: string): string {
  if (!R2_PUBLIC_URL) throw new Error('R2_PUBLIC_URL is not set')
  return `${R2_PUBLIC_URL}/${r2Key}`
}
