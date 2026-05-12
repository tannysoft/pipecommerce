import { NextResponse, type NextRequest } from 'next/server'
import { runReportSnapshot } from '@/lib/cron-tasks.ts'
import { verifyCronRequest } from '@/lib/cron-auth.ts'

export async function POST(req: NextRequest) {
  const auth = verifyCronRequest(req)
  if (auth) return auth
  const result = await runReportSnapshot()
  return NextResponse.json({ ok: true, ...result })
}
