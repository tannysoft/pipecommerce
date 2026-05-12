import { and, eq, isNotNull, sql } from '@pipecommerce/db'
import {
  customerLoyalty,
  loyaltyLedger,
  shopDomains,
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
