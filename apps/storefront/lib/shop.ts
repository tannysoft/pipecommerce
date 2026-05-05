import { and, eq } from '@pipecommerce/db'
import { shopDomains, shops } from '@pipecommerce/db/schema'
import { cache } from 'react'
import { db } from './db.ts'

const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN ?? 'pipecommerce.app').toLowerCase()

/**
 * Suffixes ที่เรา interpret เป็น "subdomain ของ platform"
 *   {slug}.pipecommerce.app  → prod default subdomain
 *   {slug}.localhost          → dev (browsers resolve *.localhost ให้เอง)
 */
const SUBDOMAIN_SUFFIXES = [`.${PLATFORM_DOMAIN}`, '.localhost']

export type StorefrontShop = {
  id: string
  slug: string
  name: string
  status: string
  currency: string
  timezone: string
}

/**
 * lookup shop จาก hostname ของ request
 *
 * Order of resolution:
 *   1. Custom domain — match `shop_domains.hostname` exact (ssl_status=active)
 *   2. Default subdomain — `{slug}.{platform}` หรือ `{slug}.localhost`
 *
 * ใช้ React 19 cache() เพื่อ dedupe ภายใน 1 request (layout + page เรียกซ้ำได้ฟรี)
 *
 * Phase 3+: เพิ่ม KV lookup ก่อน DB เพื่อ reduce roundtrip
 */
export const lookupShopByHost = cache(
  async (rawHost: string): Promise<StorefrontShop | null> => {
    const host = rawHost.toLowerCase().replace(/:\d+$/, '')
    if (!host) return null

    // 1. custom domain
    const [byCustomDomain] = await db
      .select({
        id: shops.id,
        slug: shops.slug,
        name: shops.name,
        status: shops.status,
        currency: shops.currency,
        timezone: shops.timezone,
      })
      .from(shopDomains)
      .innerJoin(shops, eq(shopDomains.shopId, shops.id))
      .where(and(eq(shopDomains.hostname, host), eq(shopDomains.sslStatus, 'active')))
      .limit(1)

    if (byCustomDomain) return byCustomDomain

    // 2. {slug}.{suffix} subdomain
    for (const suffix of SUBDOMAIN_SUFFIXES) {
      if (!host.endsWith(suffix)) continue
      const slug = host.slice(0, -suffix.length)
      if (!slug || slug.includes('.')) continue

      const [byShopSlug] = await db
        .select({
          id: shops.id,
          slug: shops.slug,
          name: shops.name,
          status: shops.status,
          currency: shops.currency,
          timezone: shops.timezone,
        })
        .from(shops)
        .where(eq(shops.slug, slug))
        .limit(1)

      if (byShopSlug) return byShopSlug
    }

    return null
  },
)
