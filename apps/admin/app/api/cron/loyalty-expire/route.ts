import { NextResponse, type NextRequest } from 'next/server'
import { runLoyaltyExpire } from '@/lib/cron-tasks.ts'
import { verifyCronRequest } from '@/lib/cron-auth.ts'

export async function POST(req: NextRequest) {
  const auth = verifyCronRequest(req)
  if (auth) return auth
  const result = await runLoyaltyExpire()
  return NextResponse.json({ ok: true, ...result })
}
