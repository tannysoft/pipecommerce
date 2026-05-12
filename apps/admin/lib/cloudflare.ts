/**
 * Cloudflare for SaaS — Custom Hostnames API client
 *
 * Flow:
 *   1. ลูกค้าใส่ domain ของตัวเอง (เช่น narakshop.com) ใน admin
 *   2. createCustomHostname() → CF ออก SSL cert auto + return hostname_id
 *   3. แสดง verification record + target ให้ลูกค้าเอาไปใส่ใน DNS provider
 *      ของตัวเอง
 *   4. cron poll getHostnameStatus() ทุก 5 นาที (ดู /api/cron/sync-hostnames)
 *      → update shop_domains.ssl_status เมื่อ active
 *   5. storefront `lookupShopByHost(host)` match `shop_domains.hostname`
 *      → resolve shop → render
 *
 * ENV:
 *   CF_ACCOUNT_ID         — Cloudflare account ID
 *   CF_ZONE_ID            — zone ID ของ pipecommerce.com
 *   CF_API_TOKEN          — token with `SSL and Certificates: Edit` permission
 *   CF_FALLBACK_ORIGIN    — `storefront-production-xxx.up.railway.app`
 *                          ที่ CF จะ proxy ไป (must be reachable; not used in path)
 *
 * Docs: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
 */

const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

type CFResult<T> = {
  success: boolean
  errors: Array<{ code: number; message: string }>
  messages: unknown[]
  result: T
}

export type CustomHostnameSSL = {
  status: 'pending_validation' | 'pending_issuance' | 'pending_deployment' | 'active' | 'failed'
  method: 'http' | 'cname' | 'txt'
  type: 'dv'
  validation_records?: Array<{
    txt_name?: string
    txt_value?: string
    http_url?: string
    http_body?: string
  }>
}

export type CFCustomHostname = {
  id: string
  hostname: string
  ssl: CustomHostnameSSL
  status: 'active' | 'pending' | 'active_redeploying' | 'moved' | 'pending_deletion' | 'deleted' | 'pending_blocked' | 'pending_migration' | 'pending_provisioned' | 'test_pending' | 'test_active' | 'test_active_apex' | 'test_blocked' | 'test_failed' | 'provisioned' | 'blocked'
  verification_errors?: string[]
  ownership_verification?: {
    type: 'txt' | 'http'
    name?: string
    value?: string
  }
  ownership_verification_http?: { http_url: string; http_body: string }
  created_at: string
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} not set — Cloudflare custom hostname feature disabled`)
  return v
}

async function cfFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = requireEnv('CF_API_TOKEN')
  const res = await fetch(`${CF_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const json = (await res.json()) as CFResult<T>
  if (!res.ok || !json.success) {
    const msg = json.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') ?? res.statusText
    throw new Error(`Cloudflare API error: ${msg}`)
  }
  return json.result
}

export function isCloudflareConfigured(): boolean {
  return Boolean(
    process.env.CF_ACCOUNT_ID && process.env.CF_ZONE_ID && process.env.CF_API_TOKEN,
  )
}

/**
 * Create a custom hostname — CF จะ issue cert via DCV (auto-detect HTTP-01
 * เมื่อเรา proxy ผ่าน CF, หรือ CNAME validation ถ้าลูกค้าทำ DNS-only)
 *
 * customOriginServer: ถ้าจะให้ traffic ไป origin อื่น (default = zone fallback)
 */
export async function createCustomHostname(args: {
  hostname: string
  customOriginServer?: string
}): Promise<CFCustomHostname> {
  const zoneId = requireEnv('CF_ZONE_ID')
  return cfFetch<CFCustomHostname>(`/zones/${zoneId}/custom_hostnames`, {
    method: 'POST',
    body: JSON.stringify({
      hostname: args.hostname,
      ssl: {
        method: 'http',
        type: 'dv',
        settings: { http2: 'on', min_tls_version: '1.2' },
      },
      ...(args.customOriginServer
        ? { custom_origin_server: args.customOriginServer }
        : {}),
    }),
  })
}

export async function getCustomHostname(hostnameId: string): Promise<CFCustomHostname> {
  const zoneId = requireEnv('CF_ZONE_ID')
  return cfFetch<CFCustomHostname>(`/zones/${zoneId}/custom_hostnames/${hostnameId}`)
}

export async function deleteCustomHostname(hostnameId: string): Promise<void> {
  const zoneId = requireEnv('CF_ZONE_ID')
  await cfFetch<{ id: string }>(`/zones/${zoneId}/custom_hostnames/${hostnameId}`, {
    method: 'DELETE',
  })
}

/**
 * Map CF status → shop_domains.ssl_status enum
 */
export function mapSslStatus(
  cf: CFCustomHostname,
): 'pending' | 'active' | 'failed' | 'revoked' {
  if (cf.ssl.status === 'active' && cf.status === 'active') return 'active'
  if (cf.ssl.status === 'failed' || cf.verification_errors?.length) return 'failed'
  if (cf.status === 'pending_deletion' || cf.status === 'deleted') return 'revoked'
  return 'pending'
}
