'use server'

import { and, eq } from '@pipecommerce/db'
import { shopDomains } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import {
  createCustomHostname,
  deleteCustomHostname,
  getCustomHostname,
  isCloudflareConfigured,
  mapSslStatus,
} from '@/lib/cloudflare.ts'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/

export type AddDomainResult = { ok: true; domainId: string } | { ok: false; error: string }

const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN ?? 'pipecommerce.com').toLowerCase()

export async function addCustomDomain(
  shopSlug: string,
  formData: FormData,
): Promise<AddDomainResult> {
  const { shop } = await requireShop(shopSlug)

  const hostname = String(formData.get('hostname') ?? '').trim().toLowerCase()
  if (!hostname || !HOSTNAME_RE.test(hostname)) {
    return { ok: false, error: 'รูปแบบ domain ไม่ถูกต้อง (เช่น narakshop.com)' }
  }
  if (
    hostname === PLATFORM_DOMAIN ||
    hostname.endsWith(`.${PLATFORM_DOMAIN}`)
  ) {
    return { ok: false, error: `ใช้ subdomain ของ ${PLATFORM_DOMAIN} ไม่ได้ — มีให้แล้วโดย default` }
  }

  const [existing] = await db
    .select({ id: shopDomains.id })
    .from(shopDomains)
    .where(eq(shopDomains.hostname, hostname))
    .limit(1)
  if (existing) return { ok: false, error: 'domain นี้มีร้านอื่นใช้แล้ว' }

  if (!isCloudflareConfigured()) {
    return { ok: false, error: 'Cloudflare for SaaS ยังไม่ได้ตั้งค่า — ติดต่อ admin' }
  }

  let cfHostnameId: string
  try {
    const cf = await createCustomHostname({
      hostname,
      customOriginServer: process.env.CF_FALLBACK_ORIGIN,
    })
    cfHostnameId = cf.id
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'create hostname failed'
    return { ok: false, error: msg }
  }

  const [inserted] = await db
    .insert(shopDomains)
    .values({
      shopId: shop.id,
      hostname,
      cfHostnameId,
      sslStatus: 'pending',
    })
    .returning({ id: shopDomains.id })

  revalidatePath(`/${shopSlug}/settings/domains`)
  return { ok: true, domainId: inserted!.id }
}

export async function removeCustomDomain(
  shopSlug: string,
  domainId: string,
): Promise<{ ok: boolean }> {
  const { shop } = await requireShop(shopSlug)

  const [domain] = await db
    .select()
    .from(shopDomains)
    .where(
      and(eq(shopDomains.id, domainId), eq(shopDomains.shopId, shop.id)),
    )
    .limit(1)
  if (!domain) return { ok: false }

  if (domain.cfHostnameId && isCloudflareConfigured()) {
    await deleteCustomHostname(domain.cfHostnameId).catch(() => {
      /* best-effort — CF อาจจะลบไปแล้ว */
    })
  }

  await db.delete(shopDomains).where(eq(shopDomains.id, domainId))

  revalidatePath(`/${shopSlug}/settings/domains`)
  return { ok: true }
}

export type DomainStatus = {
  domainId: string
  hostname: string
  sslStatus: string
  cfStatus: string | null
  verificationRecords: Array<{ name?: string; value?: string; type: string }>
  errors: string[]
}

export async function refreshDomainStatus(
  shopSlug: string,
  domainId: string,
): Promise<DomainStatus | { error: string }> {
  const { shop } = await requireShop(shopSlug)

  const [domain] = await db
    .select()
    .from(shopDomains)
    .where(
      and(eq(shopDomains.id, domainId), eq(shopDomains.shopId, shop.id)),
    )
    .limit(1)
  if (!domain || !domain.cfHostnameId) return { error: 'not found' }
  if (!isCloudflareConfigured()) return { error: 'cloudflare not configured' }

  const cf = await getCustomHostname(domain.cfHostnameId)
  const sslStatus = mapSslStatus(cf)

  await db
    .update(shopDomains)
    .set({
      sslStatus,
      lastCheckedAt: new Date(),
      verifiedAt: sslStatus === 'active' ? new Date() : domain.verifiedAt,
    })
    .where(eq(shopDomains.id, domainId))

  const records: DomainStatus['verificationRecords'] = []
  if (cf.ownership_verification) {
    records.push({
      type: cf.ownership_verification.type.toUpperCase(),
      name: cf.ownership_verification.name,
      value: cf.ownership_verification.value,
    })
  }
  for (const v of cf.ssl.validation_records ?? []) {
    if (v.txt_name && v.txt_value) {
      records.push({ type: 'TXT (SSL)', name: v.txt_name, value: v.txt_value })
    }
  }

  revalidatePath(`/${shopSlug}/settings/domains`)
  return {
    domainId,
    hostname: domain.hostname,
    sslStatus,
    cfStatus: cf.status,
    verificationRecords: records,
    errors: cf.verification_errors ?? [],
  }
}
