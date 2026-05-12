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

  // Railway/proxy: request.url ใช้ port ภายใน (localhost:8080) — สร้าง redirect
  // จาก x-forwarded-* แทน เพื่อให้ browser ไม่หลุดออก domain เดิม
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  const externalBase = `${proto}://${host}`
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, externalBase))

  if (!token) return redirectTo('/account/login?error=missing')

  const payload = await consumeMagicLinkToken(token)
  if (!payload) return redirectTo('/account/login?error=expired')

  const shop = await requireShopFromHost()
  if (payload.shopId !== shop.id) return redirectTo('/account/login?error=shop')

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

  return redirectTo('/account')
}
