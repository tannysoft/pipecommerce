import { and, eq } from '@pipecommerce/db'
import { customers } from '@pipecommerce/db/schema'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import {
  buildSessionToken,
  consumeMagicLinkToken,
  customerCookieOptions,
} from '@/lib/customer-auth.ts'
import { db } from '@/lib/db.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

/**
 * GET /account/verify?token=...
 * - verify HMAC + exp
 * - find or create customer for shop+email
 * - issue session token, set cookie
 * - redirect to /account
 *
 * On error: redirect to /account/login?error=...
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/account/login?error=missing', url))

  const payload = await consumeMagicLinkToken(token)
  if (!payload) {
    return NextResponse.redirect(new URL('/account/login?error=expired', url))
  }

  const shop = await requireShopFromHost()
  if (payload.shopId !== shop.id) {
    return NextResponse.redirect(new URL('/account/login?error=shop', url))
  }

  // Find or create customer
  const [existing] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.shopId, shop.id), eq(customers.email, payload.email)))
    .limit(1)

  let customerId = existing?.id
  if (!customerId) {
    const [created] = await db
      .insert(customers)
      .values({ shopId: shop.id, email: payload.email })
      .returning({ id: customers.id })
    customerId = created!.id
  }

  const sessionToken = await buildSessionToken({
    shopId: shop.id,
    customerId,
    email: payload.email,
  })

  const store = await cookies()
  store.set(customerCookieOptions.name, sessionToken, customerCookieOptions.options)

  return NextResponse.redirect(new URL('/account', url))
}
