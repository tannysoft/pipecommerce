import { sql } from '@pipecommerce/db'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db.ts'
import { verifyCronRequest } from '@/lib/cron-auth.ts'

/**
 * POST /api/cron/report-snapshot
 *
 * รันทุกวัน 02:00 ICT — pre-aggregate yesterday's sales data per shop
 * → upsert ลง report_snapshots_daily สำหรับ dashboard + email digest
 *
 * Date = "yesterday in shop timezone". MVP ใช้ shop.timezone field
 * (default Asia/Bangkok). aggregation จาก orders + refunds + loyalty_ledger
 *
 * Idempotent — ON CONFLICT (shop_id, date) DO UPDATE → รันซ้ำได้
 */
export async function POST(req: NextRequest) {
  const auth = verifyCronRequest(req)
  if (auth) return auth

  // คำนวณ "yesterday in each shop's timezone" + aggregate ใน 1 SQL
  // ไม่ join product-level (top_products) ในนี้ — เพิ่มทีหลังได้
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
      s.id AS shop_id,
      ((NOW() AT TIME ZONE s.timezone)::date - INTERVAL '1 day')::date AS date,
      COALESCE(o.cnt, 0) AS orders_count,
      COALESCE(o.paid_cnt, 0) AS orders_paid,
      COALESCE(o.cancelled_cnt, 0) AS orders_cancelled,
      COALESCE(o.gross, 0) AS gross_revenue,
      COALESCE(o.net, 0) AS net_revenue,
      COALESCE(o.tax_collected, 0) AS total_tax_collected,
      COALESCE(o.tax_owed, 0) AS total_tax_owed,
      COALESCE(o.discounts, 0) AS total_discounts,
      COALESCE(o.shipping, 0) AS total_shipping,
      COALESCE(r.cnt, 0) AS refunds_count,
      COALESCE(r.amt, 0) AS refunds_amount,
      COALESCE(c.new_cnt, 0) AS customers_new,
      COALESCE(c.ret_cnt, 0) AS customers_returning,
      COALESCE(u.units, 0) AS units_sold,
      COALESCE(l.earned, 0) AS points_earned,
      COALESCE(l.redeemed, 0) AS points_redeemed,
      '[]'::jsonb AS top_products,
      '[]'::jsonb AS top_collections,
      '[]'::jsonb AS top_discounts,
      NOW() AS computed_at
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

  return NextResponse.json({ ok: true, shops_processed: result.length })
}
