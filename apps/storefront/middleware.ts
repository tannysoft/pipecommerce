import { NextResponse, type NextRequest } from 'next/server'

const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN ?? 'pipecommerce.app').toLowerCase()

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}

/**
 * Storefront edge middleware
 *
 * - Platform root (pipecommerce.app, www.pipecommerce.app) → pass through
 * - admin.* → pass through (อยู่ที่ apps/admin)
 * - Anything else → ส่ง host ลง request header `x-shop-host`
 *   layout/page อ่าน header → lookup shop ผ่าน lib/shop.ts
 *
 * ⚠ ห้าม query DB ที่นี่ — middleware run ใน Edge runtime, postgres-js
 *   เป็น Node-only. ทำใน server component แทน
 */
export async function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase()

  if (!host) return NextResponse.next()
  if (host === PLATFORM_DOMAIN || host === `www.${PLATFORM_DOMAIN}`) {
    return NextResponse.next()
  }
  if (host.startsWith('admin.')) return NextResponse.next()

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-shop-host', host)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}
