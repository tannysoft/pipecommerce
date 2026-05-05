import { createServerClient as createSSRClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase server client สำหรับ admin app
 *
 * ใช้ใน Server Components, Route Handlers, Server Actions
 * อ่าน + เขียน session cookie ผ่าน next/headers
 *
 * Usage:
 *   const supabase = await createServerClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // setAll ถูก call จาก Server Component → ignored
            // session refresh ทำใน middleware แทน
          }
        },
      },
    },
  )
}
