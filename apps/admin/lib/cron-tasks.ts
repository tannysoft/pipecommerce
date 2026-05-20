import { and, eq, gte, isNotNull, lt, lte, sql } from '@pipecommerce/db'
import {
  customerLoyalty,
  loyaltyLedger,
  reportEmailSubscriptions,
  reportSnapshotsDaily,
  shopDomains,
  shops,
  webhookDeliveries,
  webhooks,
} from '@pipecommerce/db/schema'
import {
  getCustomHostname,
  isCloudflareConfigured,
  mapSslStatus,
} from './cloudflare.ts'
import { db } from './db.ts'

/**
 * Pure cron task functions — ใช้ได้ทั้งจาก HTTP route handlers
 * (manual trigger / external curl) และจาก scripts/worker.ts (in-process schedule)
 *
 * แต่ละ task return ตัวเลข/object สำหรับ logging
 */

export async function runLoyaltyExpire(): Promise<{ expired: number; customers: number }> {
  const now = new Date()
  const expiredEarns = await db.execute(sql`
    SELECT e.id AS earn_id, e.customer_id, e.shop_id, e.program_id, e.points
    FROM loyalty_ledger e
    WHERE e.type = 'earn'
      AND e.expires_at IS NOT NULL
      AND e.expires_at <= ${now}
      AND NOT EXISTS (
        SELECT 1 FROM loyalty_ledger x
        WHERE x.type = 'expire'
          AND x.reference_type = 'expire'
          AND x.reference_id = e.id
      )
    LIMIT 5000
  `)
  if (expiredEarns.length === 0) return { expired: 0, customers: 0 }

  const byCustomer = new Map<
    string,
    { customerId: string; shopId: string; programId: string; total: number; earnIds: string[] }
  >()
  for (const row of expiredEarns as unknown as Array<{
    earn_id: string
    customer_id: string
    shop_id: string
    program_id: string
    points: number
  }>) {
    const key = row.customer_id
    const grp = byCustomer.get(key) ?? {
      customerId: row.customer_id,
      shopId: row.shop_id,
      programId: row.program_id,
      total: 0,
      earnIds: [],
    }
    grp.total += row.points
    grp.earnIds.push(row.earn_id)
    byCustomer.set(key, grp)
  }

  let totalExpired = 0
  for (const grp of byCustomer.values()) {
    await db.transaction(async (tx) => {
      const [cache] = await tx
        .select({ balance: customerLoyalty.pointsBalance })
        .from(customerLoyalty)
        .where(
          and(
            eq(customerLoyalty.customerId, grp.customerId),
            eq(customerLoyalty.shopId, grp.shopId),
          ),
        )
        .limit(1)
      let runningBalance = cache?.balance ?? 0

      for (const earnId of grp.earnIds) {
        const [earn] = await tx
          .select({ points: loyaltyLedger.points })
          .from(loyaltyLedger)
          .where(eq(loyaltyLedger.id, earnId))
          .limit(1)
        if (!earn) continue
        runningBalance = Math.max(0, runningBalance - earn.points)
        await tx.insert(loyaltyLedger).values({
          customerId: grp.customerId,
          shopId: grp.shopId,
          programId: grp.programId,
          type: 'expire',
          points: -earn.points,
          balanceAfter: runningBalance,
          reason: 'expiry',
          referenceType: 'expire',
          referenceId: earnId,
        })
      }
      await tx
        .update(customerLoyalty)
        .set({ pointsBalance: runningBalance, updatedAt: new Date() })
        .where(
          and(
            eq(customerLoyalty.customerId, grp.customerId),
            eq(customerLoyalty.shopId, grp.shopId),
          ),
        )
    })
    totalExpired += grp.total
  }

  return { expired: totalExpired, customers: byCustomer.size }
}

export async function runLoyaltyReconcile(): Promise<{ reconciled: number }> {
  const result = await db.execute(sql`
    UPDATE customer_loyalty cl
    SET points_balance = COALESCE(s.total, 0),
        updated_at = NOW()
    FROM (
      SELECT customer_id, shop_id, SUM(points)::int AS total
      FROM loyalty_ledger
      GROUP BY customer_id, shop_id
    ) s
    WHERE cl.customer_id = s.customer_id
      AND cl.shop_id = s.shop_id
      AND cl.points_balance <> COALESCE(s.total, 0)
    RETURNING cl.customer_id
  `)
  return { reconciled: result.length }
}

export async function runReportSnapshot(): Promise<{ shops: number }> {
  const result = await db.execute(sql`
    INSERT INTO report_snapshots_daily (
      shop_id, date,
      orders_count, orders_paid, orders_cancelled,
      gross_revenue, net_revenue,
      total_tax_collected, total_tax_owed,
      total_discounts, total_shipping,
      refunds_count, refunds_amount,
      customers_new, customers_returning,
      units_sold,
      points_earned, points_redeemed,
      top_products, top_collections, top_discounts,
      computed_at
    )
    SELECT
      s.id, ((NOW() AT TIME ZONE s.timezone)::date - INTERVAL '1 day')::date,
      COALESCE(o.cnt, 0), COALESCE(o.paid_cnt, 0), COALESCE(o.cancelled_cnt, 0),
      COALESCE(o.gross, 0), COALESCE(o.net, 0),
      COALESCE(o.tax_collected, 0), COALESCE(o.tax_owed, 0),
      COALESCE(o.discounts, 0), COALESCE(o.shipping, 0),
      COALESCE(r.cnt, 0), COALESCE(r.amt, 0),
      COALESCE(c.new_cnt, 0), COALESCE(c.ret_cnt, 0),
      COALESCE(u.units, 0),
      COALESCE(l.earned, 0), COALESCE(l.redeemed, 0),
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      NOW()
    FROM shops s
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) AS cnt,
        COUNT(*) FILTER (WHERE financial_status = 'paid') AS paid_cnt,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_cnt,
        SUM(total_price) AS gross,
        SUM(total_price - total_tax - total_discounts) AS net,
        SUM(total_tax) AS tax_collected,
        SUM(total_tax) AS tax_owed,
        SUM(total_discounts) AS discounts,
        SUM(total_shipping) AS shipping
      FROM orders
      WHERE shop_id = s.id
        AND created_at >= ((NOW() AT TIME ZONE s.timezone)::date - INTERVAL '1 day')
        AND created_at <  (NOW() AT TIME ZONE s.timezone)::date
    ) o ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt, SUM(amount) AS amt
      FROM refunds
      WHERE shop_id = s.id
        AND created_at >= ((NOW() AT TIME ZONE s.timezone)::date - INTERVAL '1 day')
        AND created_at <  (NOW() AT TIME ZONE s.timezone)::date
    ) r ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE orders_count = 1) AS new_cnt,
        COUNT(*) FILTER (WHERE orders_count > 1) AS ret_cnt
      FROM customers
      WHERE shop_id = s.id
        AND updated_at >= ((NOW() AT TIME ZONE s.timezone)::date - INTERVAL '1 day')
        AND updated_at <  (NOW() AT TIME ZONE s.timezone)::date
    ) c ON TRUE
    LEFT JOIN LATERAL (
      SELECT SUM(oli.quantity)::int AS units
      FROM order_line_items oli
      JOIN orders o2 ON o2.id = oli.order_id
      WHERE o2.shop_id = s.id
        AND o2.created_at >= ((NOW() AT TIME ZONE s.timezone)::date - INTERVAL '1 day')
        AND o2.created_at <  (NOW() AT TIME ZONE s.timezone)::date
    ) u ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        SUM(points) FILTER (WHERE type = 'earn')::int AS earned,
        -SUM(points) FILTER (WHERE type = 'redeem')::int AS redeemed
      FROM loyalty_ledger
      WHERE shop_id = s.id
        AND created_at >= ((NOW() AT TIME ZONE s.timezone)::date - INTERVAL '1 day')
        AND created_at <  (NOW() AT TIME ZONE s.timezone)::date
    ) l ON TRUE
    WHERE s.deleted_at IS NULL
    ON CONFLICT (shop_id, date) DO UPDATE SET
      orders_count = EXCLUDED.orders_count,
      orders_paid = EXCLUDED.orders_paid,
      orders_cancelled = EXCLUDED.orders_cancelled,
      gross_revenue = EXCLUDED.gross_revenue,
      net_revenue = EXCLUDED.net_revenue,
      total_tax_collected = EXCLUDED.total_tax_collected,
      total_tax_owed = EXCLUDED.total_tax_owed,
      total_discounts = EXCLUDED.total_discounts,
      total_shipping = EXCLUDED.total_shipping,
      refunds_count = EXCLUDED.refunds_count,
      refunds_amount = EXCLUDED.refunds_amount,
      customers_new = EXCLUDED.customers_new,
      customers_returning = EXCLUDED.customers_returning,
      units_sold = EXCLUDED.units_sold,
      points_earned = EXCLUDED.points_earned,
      points_redeemed = EXCLUDED.points_redeemed,
      computed_at = NOW()
    RETURNING shop_id
  `)
  return { shops: result.length }
}

/**
 * Process pending webhook deliveries with exponential backoff
 * Stages: 1m → 5m → 30m → 2h → 12h → 24h → fail
 */
const BACKOFF_MINUTES = [1, 5, 30, 2 * 60, 12 * 60, 24 * 60]
const MAX_ATTEMPTS = BACKOFF_MINUTES.length

export async function runWebhookDeliveries(): Promise<{
  attempted: number
  succeeded: number
  failed: number
  retrying: number
}> {
  const now = new Date()
  const pending = await db
    .select({
      delivery: webhookDeliveries,
      webhookUrl: webhooks.url,
      webhookSecret: webhooks.secret,
      webhookActive: webhooks.isActive,
    })
    .from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
    .where(
      and(
        eq(webhookDeliveries.status, 'pending'),
        lte(webhookDeliveries.nextRetryAt, now),
      ),
    )
    .limit(100)

  let succeeded = 0
  let retrying = 0
  let failed = 0

  for (const row of pending) {
    const d = row.delivery
    if (!row.webhookActive) {
      await db
        .update(webhookDeliveries)
        .set({ status: 'failed', responseBody: 'webhook disabled' })
        .where(eq(webhookDeliveries.id, d.id))
      failed++
      continue
    }

    const body = JSON.stringify({ topic: d.topic, payload: d.payload })
    const ts = Math.floor(Date.now() / 1000)
    const signature = await computeWebhookHmac(row.webhookSecret, `${ts}.${body}`)

    let responseCode: number | null = null
    let responseBody: string | null = null
    let ok = false
    try {
      const res = await fetch(row.webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pipecommerce-topic': d.topic,
          'x-pipecommerce-signature': `t=${ts},v1=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      responseCode = res.status
      responseBody = (await res.text()).slice(0, 1000)
      ok = res.ok
    } catch (err) {
      responseBody = err instanceof Error ? err.message : 'fetch failed'
    }

    const attempts = d.attempts + 1
    if (ok) {
      await db
        .update(webhookDeliveries)
        .set({
          status: 'success',
          attempts,
          responseCode,
          responseBody,
          deliveredAt: new Date(),
          nextRetryAt: null,
        })
        .where(eq(webhookDeliveries.id, d.id))
      succeeded++
    } else if (attempts >= MAX_ATTEMPTS) {
      await db
        .update(webhookDeliveries)
        .set({
          status: 'failed',
          attempts,
          responseCode,
          responseBody,
        })
        .where(eq(webhookDeliveries.id, d.id))
      failed++
    } else {
      const nextRetryMin = BACKOFF_MINUTES[attempts - 1] ?? 60
      const nextRetryAt = new Date(Date.now() + nextRetryMin * 60 * 1000)
      await db
        .update(webhookDeliveries)
        .set({
          status: 'pending',
          attempts,
          responseCode,
          responseBody,
          nextRetryAt,
        })
        .where(eq(webhookDeliveries.id, d.id))
      retrying++
    }
  }

  return { attempted: pending.length, succeeded, failed, retrying }
}

async function computeWebhookHmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
  let hex = ''
  for (const b of sig) hex += b.toString(16).padStart(2, '0')
  return hex
}

/**
 * Daily report email digest — send to all active 'daily' subscribers
 * Uses yesterday's report_snapshots_daily row (computed by report-snapshot cron at 02:00)
 *
 * Idempotent-ish: skip subscribers whose last_sent_at >= today UTC
 */
export async function runDailyReportEmail(): Promise<{
  sent: number
  skipped: number
  failed: number
}> {
  const { Resend } = await import('resend')
  const apiKey = process.env.RESEND_API_KEY
  const fromAddr = process.env.RESEND_FROM_ADDRESS ?? 'noreply@pipecommerce.com'
  if (!apiKey) return { sent: 0, skipped: 0, failed: 0 }
  const resend = new Resend(apiKey)

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const subs = await db
    .select({ sub: reportEmailSubscriptions, shop: shops })
    .from(reportEmailSubscriptions)
    .innerJoin(shops, eq(reportEmailSubscriptions.shopId, shops.id))
    .where(
      and(
        eq(reportEmailSubscriptions.type, 'daily'),
        eq(reportEmailSubscriptions.isActive, true),
      ),
    )

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const { sub, shop } of subs) {
    if (sub.lastSentAt && sub.lastSentAt >= todayStart) {
      skipped++
      continue
    }

    // Yesterday in shop timezone
    const yesterdayISO = await db.execute(sql`
      SELECT ((NOW() AT TIME ZONE ${shop.timezone})::date - INTERVAL '1 day')::date AS d
    `)
    const yesterday = (yesterdayISO as unknown as Array<{ d: string }>)[0]?.d
    if (!yesterday) continue

    const [snap] = await db
      .select()
      .from(reportSnapshotsDaily)
      .where(
        and(
          eq(reportSnapshotsDaily.shopId, shop.id),
          eq(reportSnapshotsDaily.date, yesterday),
        ),
      )
      .limit(1)

    const html = renderDailyDigest(shop.name, yesterday, snap)
    try {
      await resend.emails.send({
        from: `${shop.name} <${fromAddr}>`,
        to: sub.recipientEmail,
        subject: `[${shop.name}] รายงานยอดขาย ${yesterday}`,
        html,
        tags: [{ name: 'type', value: 'daily-digest' }],
      })
      await db
        .update(reportEmailSubscriptions)
        .set({ lastSentAt: new Date() })
        .where(eq(reportEmailSubscriptions.id, sub.id))
      sent++
    } catch (err) {
      console.error('[daily-digest] send failed:', err)
      failed++
    }
  }

  return { sent, skipped, failed }
}

function renderDailyDigest(
  shopName: string,
  date: string,
  snap: typeof reportSnapshotsDaily.$inferSelect | undefined,
): string {
  const fmt = (n: string | number | null | undefined) =>
    Number(n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const ordersPaid = snap?.ordersPaid ?? 0
  const gross = fmt(snap?.grossRevenue)
  const units = snap?.unitsSold ?? 0
  const newCust = snap?.customersNew ?? 0
  const ret = snap?.customersReturning ?? 0

  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="margin: 0 0 8px;">${escapeHtml(shopName)}</h2>
  <p style="color: #6b7280; margin: 0 0 24px;">รายงานยอดขายของวันที่ ${escapeHtml(date)}</p>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0;">คำสั่งซื้อที่จ่ายแล้ว</td><td style="text-align: right; font-weight: 600;">${ordersPaid}</td></tr>
    <tr><td style="padding: 8px 0;">ยอดขายรวม</td><td style="text-align: right; font-weight: 600;">${gross} บาท</td></tr>
    <tr><td style="padding: 8px 0;">จำนวนสินค้าที่ขายได้</td><td style="text-align: right; font-weight: 600;">${units}</td></tr>
    <tr><td style="padding: 8px 0;">ลูกค้าใหม่</td><td style="text-align: right; font-weight: 600;">${newCust}</td></tr>
    <tr><td style="padding: 8px 0;">ลูกค้าเก่ากลับมาซื้อ</td><td style="text-align: right; font-weight: 600;">${ret}</td></tr>
  </table>
  <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">PipeCommerce · เปิด admin เพื่อดูรายละเอียดเพิ่มเติม</p>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export async function runSyncHostnames(): Promise<{
  checked: number
  updated: number
  errors: Array<{ hostname: string; error: string }>
}> {
  if (!isCloudflareConfigured()) {
    return { checked: 0, updated: 0, errors: [] }
  }
  const pending = await db
    .select()
    .from(shopDomains)
    .where(isNotNull(shopDomains.cfHostnameId))

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
  return { checked: toCheck.length, updated, errors }
}
