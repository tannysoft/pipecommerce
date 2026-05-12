import { and, eq } from '@pipecommerce/db'
import { shopDomains, shops } from '@pipecommerce/db/schema'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { db } from './db.ts'

const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN ?? 'pipecommerce.app').toLowerCase()

/**
 * Suffixes ที่เรา interpret เป็น "subdomain ของ platform"
 *   {slug}.pipecommerce.app  → prod default subdomain
 *   {slug}.localhost          → dev (browsers resolve *.localhost ให้เอง)
 */
const SUBDOMAIN_SUFFIXES = [`.${PLATFORM_DOMAIN}`, '.localhost']

export type ShopMenuItem = { label: string; href: string }

export type ShopAnalytics = {
  ga4MeasurementId?: string | null // "G-XXXXXXXXXX"
  metaPixelId?: string | null // numeric string
}

export type ShopSettings = {
  fonts?: { heading?: string; body?: string }
  tax?: {
    mode?: 'none' | 'inclusive_customer' | 'exclusive_customer' | 'shop_absorbs'
    rate?: number
    label?: string
  }
  shipping?: {
    defaultRate?: number
    freeThreshold?: number | null
  }
  menu?: ShopMenuItem[]
  analytics?: ShopAnalytics
  // อื่นๆ ที่จะเพิ่มภายหลัง — seo, robots_txt, ฯลฯ
  [k: string]: unknown
}

export type StorefrontShop = {
  id: string
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  status: string
  currency: string
  timezone: string
  settings: ShopSettings
}

const shopColumns = {
  id: shops.id,
  slug: shops.slug,
  name: shops.name,
  description: shops.description,
  logoUrl: shops.logoUrl,
  status: shops.status,
  currency: shops.currency,
  timezone: shops.timezone,
  settings: shops.settings,
} as const

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
      .select(shopColumns)
      .from(shopDomains)
      .innerJoin(shops, eq(shopDomains.shopId, shops.id))
      .where(and(eq(shopDomains.hostname, host), eq(shopDomains.sslStatus, 'active')))
      .limit(1)

    if (byCustomDomain) {
      return { ...byCustomDomain, settings: (byCustomDomain.settings ?? {}) as ShopSettings }
    }

    // 2. {slug}.{suffix} subdomain
    for (const suffix of SUBDOMAIN_SUFFIXES) {
      if (!host.endsWith(suffix)) continue
      const slug = host.slice(0, -suffix.length)
      if (!slug || slug.includes('.')) continue

      const [byShopSlug] = await db
        .select(shopColumns)
        .from(shops)
        .where(eq(shops.slug, slug))
        .limit(1)

      if (byShopSlug) {
        return { ...byShopSlug, settings: (byShopSlug.settings ?? {}) as ShopSettings }
      }
    }

    return null
  },
)

/**
 * อ่าน host จาก request — ใช้ x-shop-host ถ้ามี (proxy set) มิเช่นนั้น fallback host
 * Reserved subdomain (admin., console.) + platform apex/www → คืน null
 *
 * (Next 16 + OpenNext ไม่รองรับ proxy/middleware ที่ set header — ต้องอ่าน
 * host header โดยตรงและ filter ใน server component)
 */
export async function resolveShopHost(): Promise<string | null> {
  const h = await headers()
  // Railway/CF/proxy: x-forwarded-host = user-facing hostname,
  // `host` = internal container hostname (เช่น localhost:8080)
  const raw = (
    h.get('x-shop-host') ??
    h.get('x-forwarded-host') ??
    h.get('host') ??
    ''
  ).toLowerCase()
  const host = raw.replace(/:\d+$/, '')
  if (!host) return null
  if (host === PLATFORM_DOMAIN || host === `www.${PLATFORM_DOMAIN}`) return null
  if (host.startsWith('admin.') || host.startsWith('console.')) return null
  return host
}

/**
 * Build absolute URL จาก request — สำหรับ magic link, payment redirect, ฯลฯ
 * อ่าน x-forwarded-host/proto จาก Railway proxy ก่อน fallback `host`/`http`
 */
export async function buildAbsoluteUrl(pathAndQuery: string): Promise<string> {
  const h = await headers()
  const host =
    h.get('x-forwarded-host') ?? h.get('host') ?? `${PLATFORM_DOMAIN}`
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`
  return `${proto}://${host}${path}`
}

/**
 * Variant ของ lookupShopByHost ที่บังคับว่าต้องเจอ shop —
 * notFound() ถ้าไม่เจอ. ใช้ใน /products/[handle], /collections/[handle], etc.
 *
 * Home page (/) ใช้ lookupShopByHost ตรงๆ เพื่อ render platform welcome
 * แทนที่จะ 404 เมื่อ host ไม่ใช่ shop
 */
export async function requireShopFromHost(): Promise<StorefrontShop> {
  const host = await resolveShopHost()
  if (!host) notFound()
  const shop = await lookupShopByHost(host)
  if (!shop) notFound()
  return shop
}
