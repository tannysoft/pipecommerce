import { createServerClient as createSSRClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresh session cookie ทุก request — เรียกจาก app's middleware.ts
 *
 * Pattern (Next.js 16 + Supabase SSR):
 *   1. Build response object
 *   2. Create supabase client ที่อ่าน req cookies + เขียน res cookies
 *   3. supabase.auth.getUser() → ทำให้ refresh token ถ้าจำเป็น
 *   4. Return response (carry refreshed cookies)
 *
 * Caller สามารถ inspect user แล้ว gate route ได้ (e.g., redirect to /login
 * ถ้าไม่ login)
 */
export async function updateAdminSession(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabase = createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            req.cookies.set(name, value)
          }
          res = NextResponse.next({ request: req })
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // ⚠ ห้ามมี logic ระหว่าง createSSRClient กับ getUser() —
  //   มันจะทำให้ session refresh ผิด timing
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { res, user }
}
