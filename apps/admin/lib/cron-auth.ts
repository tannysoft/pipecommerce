import { NextResponse, type NextRequest } from 'next/server'

/**
 * Cron endpoint auth — Railway Cron จะ curl ไปที่ /api/cron/<name> โดยใส่
 * header `Authorization: Bearer <CRON_SECRET>`. ตรวจตรงนี้ก่อน execute
 *
 * Set CRON_SECRET ใน Railway service variables (random base64, 32+ bytes)
 * Set ใน Railway Cron config (Settings → Cron) ด้วย Bearer header เดียวกัน
 */
const CRON_SECRET = process.env.CRON_SECRET

export function verifyCronRequest(req: NextRequest): NextResponse | null {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${CRON_SECRET}`
  if (!constantTimeEqual(auth, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
