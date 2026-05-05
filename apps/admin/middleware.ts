import { updateAdminSession } from '@pipecommerce/auth/admin/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: [
    // ใช้กับทุก route ยกเว้น static + api/auth
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}

const PUBLIC_PATHS = ['/login', '/auth/callback']

export async function middleware(req: NextRequest) {
  const { res, user } = await updateAdminSession(req)
  const { pathname } = req.nextUrl

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  // ไม่ login + เข้า protected route → redirect /login
  if (!user && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // login + เข้า /login → redirect home
  if (user && pathname === '/login') {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return res
}
