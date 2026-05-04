import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

export async function middleware(req: NextRequest) {
  // TODO Phase 2: Supabase Auth gate — redirect to /login if no session
  //   ดู docs/ARCHITECTURE.md#authentication
  return NextResponse.next()
}
