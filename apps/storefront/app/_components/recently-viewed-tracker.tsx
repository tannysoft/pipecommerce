'use client'

import { useEffect } from 'react'

const COOKIE_NAME = 'pc_recent'
const MAX = 8
const TTL_DAYS = 30

/**
 * Track recently viewed products — store in cookie (handles only, comma-separated)
 *
 * Reads server-side via `getRecentlyViewedHandles()` to render <RecentlyViewed>
 */
export function RecentlyViewedTracker({ handle }: { handle: string }) {
  useEffect(() => {
    if (!handle) return
    const raw = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.split('=')[1]
    const list = raw ? decodeURIComponent(raw).split(',').filter(Boolean) : []
    const next = [handle, ...list.filter((h) => h !== handle)].slice(0, MAX)
    const exp = new Date()
    exp.setDate(exp.getDate() + TTL_DAYS)
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(next.join(','))}; expires=${exp.toUTCString()}; path=/; SameSite=Lax`
  }, [handle])
  return null
}
