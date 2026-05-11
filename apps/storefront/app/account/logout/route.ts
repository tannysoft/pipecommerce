import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { customerCookieOptions } from '@/lib/customer-auth.ts'

export async function GET(request: NextRequest) {
  const store = await cookies()
  store.delete(customerCookieOptions.name)
  return NextResponse.redirect(new URL('/', request.url))
}

export async function POST(request: NextRequest) {
  return GET(request)
}
