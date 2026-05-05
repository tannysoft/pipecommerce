import { createServerClient } from '@pipecommerce/auth/admin/server'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Magic link / OAuth callback handler
 *
 * Supabase ส่ง user มาที่นี่หลัง click ลิงก์ใน email พร้อม ?code=...
 * เรา exchange code → session → set cookie → redirect ไปหน้าที่ต้องการ
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', req.url))
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url),
    )
  }

  return NextResponse.redirect(new URL(next, req.url))
}
