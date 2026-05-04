import { NextResponse, type NextRequest } from 'next/server'

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? 'pipecommerce.app'

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase()

  // Marketing site root + admin = pass through
  if (host === PLATFORM_DOMAIN || host === `www.${PLATFORM_DOMAIN}`) {
    return NextResponse.next()
  }
  if (host.startsWith('admin.')) {
    return NextResponse.next()
  }

  // TODO Phase 2: lookup shop จาก hostname (KV cache → DB fallback)
  //   ดู docs/ARCHITECTURE.md#hosting--domain-layout
  //   ดู docs/CUSTOM-DOMAIN.md

  const res = NextResponse.next()
  res.headers.set('x-shop-host', host)
  return res
}
