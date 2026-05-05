'use server'

import { createServerClient } from '@pipecommerce/auth/admin/server'
import { shopMembers, shops } from '@pipecommerce/db/schema'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db.ts'

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'cdn',
  'help',
  'login',
  'logout',
  'mail',
  'onboarding',
  'pricing',
  'privacy',
  'shops',
  'static',
  'support',
  'terms',
  'www',
  '_next',
])

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export type CreateShopResult = { ok: true } | { ok: false; error: string }

export async function createShop(formData: FormData): Promise<CreateShopResult> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'ไม่ได้ login' }

  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase()

  if (!name) return { ok: false, error: 'กรุณากรอกชื่อร้าน' }
  if (slug.length < 3 || slug.length > 30) return { ok: false, error: 'URL ต้องยาว 3-30 ตัวอักษร' }
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, error: 'URL ใช้ได้เฉพาะ a-z, 0-9, และ - (ขึ้น/ลงท้ายด้วยตัวอักษรหรือเลข)' }
  }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: 'URL นี้สงวนไว้ — เลือกอื่น' }

  let createdSlug: string
  try {
    const result = await db.transaction(async (tx) => {
      const [shop] = await tx
        .insert(shops)
        .values({
          slug,
          name,
          ownerUserId: user.id,
          status: 'trial',
        })
        .returning({ id: shops.id, slug: shops.slug })

      if (!shop) throw new Error('insert shop failed')

      await tx.insert(shopMembers).values({
        shopId: shop.id,
        userId: user.id,
        role: 'owner',
        acceptedAt: new Date(),
      })

      return shop
    })
    createdSlug = result.slug
  } catch (error) {
    // Postgres unique violation
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'URL นี้มีคนใช้แล้ว — เลือกอื่น' }
    }
    throw error
  }

  redirect(`/${createdSlug}/dashboard`)
}
