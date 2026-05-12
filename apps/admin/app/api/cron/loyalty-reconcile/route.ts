import { sql } from '@pipecommerce/db'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db.ts'
import { verifyCronRequest } from '@/lib/cron-auth.ts'

/**
 * POST /api/cron/loyalty-reconcile
 *
 * รันทุกคืน (เช่น 04:00 ICT) — recompute customer_loyalty.points_balance
 * จาก loyalty_ledger ตรงๆ เพื่อกัน drift
 *
 * Use case: ถ้ามี bug หรือ race ที่ทำให้ cache เพี้ยน — งานนี้แก้ทุกคืน
 */
export async function POST(req: NextRequest) {
  const auth = verifyCronRequest(req)
  if (auth) return auth

  // Single UPDATE ... FROM (sum) → atomic per row
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

  return NextResponse.json({ ok: true, reconciled: result.length })
}
