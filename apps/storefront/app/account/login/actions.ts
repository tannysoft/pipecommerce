'use server'

import { buildMagicLinkToken } from '@/lib/customer-auth.ts'
import { sendMagicLink } from '@/lib/email.ts'
import { buildAbsoluteUrl, requireShopFromHost } from '@/lib/shop.ts'

export type RequestMagicLinkResult = { ok: true } | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function requestMagicLink(
  formData: FormData,
): Promise<RequestMagicLinkResult> {
  const shop = await requireShopFromHost()

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'กรุณากรอกอีเมลที่ถูกต้อง' }
  }

  const token = await buildMagicLinkToken({ shopId: shop.id, email })

  const link = await buildAbsoluteUrl(
    `/account/verify?token=${encodeURIComponent(token)}`,
  )

  try {
    await sendMagicLink({
      to: email,
      shop: { name: shop.name, currency: shop.currency },
      link,
    })
  } catch (error) {
    console.error('[account] magic link email failed', error)
    return { ok: false, error: 'ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง' }
  }

  return { ok: true }
}
