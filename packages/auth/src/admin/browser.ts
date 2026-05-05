'use client'

import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

/**
 * Supabase browser client สำหรับ admin app (client components)
 *
 * Usage ใน 'use client' file:
 *   const supabase = createBrowserClient()
 *   await supabase.auth.signOut()
 */
export function createBrowserClient() {
  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
