import { NextResponse, type NextRequest } from 'next/server'
import { runLoyaltyReconcile } from '@/lib/cron-tasks.ts'
import { verifyCronRequest } from '@/lib/cron-auth.ts'

export async function POST(req: NextRequest) {
  const auth = verifyCronRequest(req)
  if (auth) return auth
  const result = await runLoyaltyReconcile()
  return NextResponse.json({ ok: true, ...result })
}
