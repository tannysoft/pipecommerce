'use server'

import { and, eq } from '@pipecommerce/db'
import { newsletterSubscribers } from '@pipecommerce/db/schema'
import { headers } from 'next/headers'
import { db } from '@/lib/db.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

export type SubscribeResult = { ok: true } | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function hmacToken(shopId: string, email: string): Promise<string> {
  const secret = process.env.NEWSLETTER_UNSUB_SECRET ?? process.env.CUSTOMER_AUTH_SECRET ?? ''
  if (!secret) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${shopId}:${email}`),
  )
  const bytes = new Uint8Array(sig)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function subscribeNewsletter(
  formData: FormData,
): Promise<SubscribeResult> {
  const shop = await requireShopFromHost()

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const consentText = String(formData.get('consent') ?? '').trim()
  const source = String(formData.get('source') ?? 'footer').trim() || 'footer'

  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'รูปแบบอีเมลไม่ถูกต้อง' }
  }
  if (!consentText) {
    return { ok: false, error: 'กรุณายินยอมรับข่าวสารก่อน' }
  }

  const headersList = await headers()
  const ip =
    headersList.get('cf-connecting-ip') ??
    headersList.get('x-real-ip') ??
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  const userAgent = headersList.get('user-agent')

  // Check existing
  const [existing] = await db
    .select({ id: newsletterSubscribers.id, status: newsletterSubscribers.status })
    .from(newsletterSubscribers)
    .where(
      and(
        eq(newsletterSubscribers.shopId, shop.id),
        eq(newsletterSubscribers.email, email),
      ),
    )
    .limit(1)

  const now = new Date()
  const token = await hmacToken(shop.id, email)

  if (existing) {
    if (existing.status === 'subscribed') return { ok: true } // idempotent
    // Resubscribe
    await db
      .update(newsletterSubscribers)
      .set({
        status: 'subscribed',
        subscribedAt: now,
        unsubscribedAt: null,
        consentText,
        ip,
        userAgent,
        source,
        updatedAt: now,
      })
      .where(eq(newsletterSubscribers.id, existing.id))
  } else {
    await db.insert(newsletterSubscribers).values({
      shopId: shop.id,
      email,
      source,
      status: 'subscribed',
      ip,
      userAgent,
      consentText,
      subscribedAt: now,
      unsubscribeToken: token,
    })
  }

  return { ok: true }
}
