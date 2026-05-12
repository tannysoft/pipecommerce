import { and, eq, isNotNull, lte, sql } from '@pipecommerce/db'
import {
  customerLoyalty,
  loyaltyLedger,
  shops,
} from '@pipecommerce/db/schema'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db.ts'
import { verifyCronRequest } from '@/lib/cron-auth.ts'

/**
 * POST /api/cron/loyalty-expire
 *
 * รันทุกวัน 03:00 ICT ผ่าน Railway Cron
 *
 * Logic: หา ledger rows ที่
 *   - type = 'earn'
 *   - expires_at ≤ now
 *   - ยังไม่ถูก expire (= ไม่มี ledger row อื่นที่ reference_id = แถวนี้
 *     และ type = 'expire')
 *
 * → insert 'expire' rows + update customer_loyalty cache
 *
 * Idempotent: รันซ้ำ = no-op (เพราะ filter เอา ที่ยัง expire ไม่ออก)
 */
export async function POST(req: NextRequest) {
  const auth = verifyCronRequest(req)
  if (auth) return auth

  const now = new Date()
  let totalExpired = 0
  let totalCustomers = 0

  // 1. หา earn rows ที่หมดอายุ + ยังไม่ถูก expire
  const expiredEarns = await db.execute(sql`
    SELECT
      e.id AS earn_id,
      e.customer_id,
      e.shop_id,
      e.program_id,
      e.points
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

  if (expiredEarns.length === 0) {
    return NextResponse.json({ ok: true, expired: 0, customers: 0 })
  }

  // จัดกลุ่มตาม customer สำหรับ balance_after calc
  const byCustomer = new Map<
    string,
    {
      customerId: string
      shopId: string
      programId: string
      total: number
      earnIds: string[]
    }
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

  // 2. ทำ expire ทีละ customer
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

      // Update cache
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
    totalCustomers += 1
  }

  // Touch shops table to avoid unused warning (and so SQL `shops` reference compiles)
  void shops
  void isNotNull
  void lte

  return NextResponse.json({ ok: true, expired: totalExpired, customers: totalCustomers })
}
