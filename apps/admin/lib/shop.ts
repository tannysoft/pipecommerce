import { createServerClient } from '@pipecommerce/auth/admin/server'
import { and, eq } from '@pipecommerce/db'
import { shopMembers, shops } from '@pipecommerce/db/schema'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { db } from './db.ts'

export type ShopSettings = {
  fonts?: { heading?: string; body?: string }
  [k: string]: unknown
}

export type AdminShop = {
  id: string
  slug: string
  name: string
  status: string
  currency: string
  timezone: string
  settings: ShopSettings
}

/**
 * Verify ว่า user login + เป็น member ของ shop นี้ — ใช้ใน layout/page/action
 *
 * cache() dedupe ภายใน 1 request → layout + ทุก page เรียก requireShop ฟรี
 *
 * Fail mode:
 *   ไม่ login → redirect /login
 *   ไม่เจอ shop หรือ user ไม่เป็น member → notFound() (ไม่ leak existence)
 */
export const requireShop = cache(async (slug: string) => {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [shop] = await db
    .select({
      id: shops.id,
      slug: shops.slug,
      name: shops.name,
      status: shops.status,
      currency: shops.currency,
      timezone: shops.timezone,
      settings: shops.settings,
    })
    .from(shops)
    .innerJoin(
      shopMembers,
      and(eq(shopMembers.shopId, shops.id), eq(shopMembers.userId, user.id)),
    )
    .where(eq(shops.slug, slug))
    .limit(1)

  if (!shop) notFound()

  return {
    shop: { ...shop, settings: (shop.settings ?? {}) as ShopSettings } as AdminShop,
    user,
  }
})
