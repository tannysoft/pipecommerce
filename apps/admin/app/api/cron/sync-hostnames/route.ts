import { eq, isNotNull, ne } from '@pipecommerce/db'
import { shopDomains } from '@pipecommerce/db/schema'
import { NextResponse, type NextRequest } from 'next/server'
import {
  getCustomHostname,
  isCloudflareConfigured,
  mapSslStatus,
} from '@/lib/cloudflare.ts'
import { verifyCronRequest } from '@/lib/cron-auth.ts'
import { db } from '@/lib/db.ts'

/**
 * POST /api/cron/sync-hostnames
 *
 * รันทุก 5 นาที — poll Cloudflare เพื่อ sync ssl_status ของ shop_domains
 * ที่ยังไม่ active (pending/failed). เมื่อเป็น active → ตั้ง verifiedAt
 *
 * Skip ถ้า CF env ไม่ตั้ง
 */
export async function POST(req: NextRequest) {
  const auth = verifyCronRequest(req)
  if (auth) return auth
  if (!isCloudflareConfigured()) {
    return NextResponse.json({ ok: false, skipped: 'cloudflare not configured' })
  }

  const pending = await db
    .select()
    .from(shopDomains)
    .where(isNotNull(shopDomains.cfHostnameId))

  // Filter ในแอป (ไม่ใช่ใน SQL) เพราะมี logic เปรียบเทียบหลายแบบ
  const toCheck = pending.filter((d) => d.sslStatus !== 'active')
  let updated = 0
  const errors: Array<{ hostname: string; error: string }> = []

  for (const domain of toCheck) {
    try {
      const cf = await getCustomHostname(domain.cfHostnameId!)
      const newStatus = mapSslStatus(cf)
      if (newStatus !== domain.sslStatus) {
        await db
          .update(shopDomains)
          .set({
            sslStatus: newStatus,
            lastCheckedAt: new Date(),
            verifiedAt:
              newStatus === 'active' ? new Date() : domain.verifiedAt,
          })
          .where(eq(shopDomains.id, domain.id))
        updated += 1
      } else {
        await db
          .update(shopDomains)
          .set({ lastCheckedAt: new Date() })
          .where(eq(shopDomains.id, domain.id))
      }
    } catch (e) {
      errors.push({
        hostname: domain.hostname,
        error: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  // Touch ne to keep import in case future use
  void ne

  return NextResponse.json({
    ok: true,
    checked: toCheck.length,
    updated,
    errors,
  })
}
