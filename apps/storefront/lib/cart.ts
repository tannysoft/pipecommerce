import { and, eq, sql } from '@pipecommerce/db'
import { cartItems, carts } from '@pipecommerce/db/schema'
import { cookies } from 'next/headers'
import { db } from './db.ts'

export const CART_COOKIE = 'pc_cart'
const TTL_DAYS = 30

/**
 * Read cart by token cookie — null ถ้ายังไม่มี cart
 *
 * ใช้ใน Server Component (page.tsx ของ /cart, header summary, ฯลฯ)
 * ห้ามเรียกจาก non-action context ที่ต้องการ "create" — ใช้ getOrCreateCart แทน
 */
export async function getCartByToken(shopId: string) {
  const store = await cookies()
  const token = store.get(CART_COOKIE)?.value
  if (!token) return null

  const [cart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.shopId, shopId), eq(carts.token, token)))
    .limit(1)
  return cart ?? null
}

/**
 * Get cart ของ shop นี้ — ถ้ายังไม่มี ก็สร้างใหม่ + set cookie
 *
 * ⚠ ใช้เฉพาะใน Server Action (cookies set ได้)
 */
export async function getOrCreateCart(shopId: string, currency: string) {
  const store = await cookies()
  const existingToken = store.get(CART_COOKIE)?.value

  if (existingToken) {
    const [cart] = await db
      .select()
      .from(carts)
      .where(and(eq(carts.shopId, shopId), eq(carts.token, existingToken)))
      .limit(1)
    if (cart) return cart
  }

  const token = crypto.randomUUID().replace(/-/g, '')
  const [created] = await db
    .insert(carts)
    .values({
      shopId,
      token,
      currency,
      expiresAt: new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning()

  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TTL_DAYS * 24 * 60 * 60,
    path: '/',
  })

  if (!created) throw new Error('failed to create cart')
  return created
}

/**
 * Sum quantity ของ cart items ของ shop นี้ — สำหรับ header badge
 * คืน 0 ถ้ายังไม่มี cart cookie
 */
export async function getCartItemCount(shopId: string): Promise<number> {
  const store = await cookies()
  const token = store.get(CART_COOKIE)?.value
  if (!token) return 0

  const [row] = await db
    .select({ count: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(cartItems)
    .innerJoin(carts, eq(cartItems.cartId, carts.id))
    .where(and(eq(carts.shopId, shopId), eq(carts.token, token)))

  return row?.count ?? 0
}

