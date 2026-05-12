import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { customerCookieOptions } from '@/lib/customer-auth.ts'

export async function GET(request: NextRequest) {
  const store = await cookies()
  store.delete(customerCookieOptions.name)

  // Railway/proxy: request.url ใช้ internal port — สร้าง redirect base
  // จาก x-forwarded-* เพื่อให้ browser อยู่ที่ public domain
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const base = host ? `${proto}://${host}` : request.url
  return NextResponse.redirect(new URL('/', base))
}

export async function POST(request: NextRequest) {
  return GET(request)
}
