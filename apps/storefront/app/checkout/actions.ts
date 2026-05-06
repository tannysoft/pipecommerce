'use server'

import { and, count, eq, sql } from '@pipecommerce/db'
import {
  cartItems,
  carts,
  orderLineItems,
  orders,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CART_COOKIE, getCartByToken } from '@/lib/cart.ts'
import { db } from '@/lib/db.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

export type CheckoutResult = { ok: true } | { ok: false; error: string }

const TRACKING_TOKEN_LENGTH = 32

function randomToken(len = TRACKING_TOKEN_LENGTH): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('')
}

function readForm(formData: FormData) {
  return {
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    phone: String(formData.get('phone') ?? '').trim() || null,
    firstName: String(formData.get('firstName') ?? '').trim(),
    lastName: String(formData.get('lastName') ?? '').trim(),
    address1: String(formData.get('address1') ?? '').trim(),
    address2: String(formData.get('address2') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim(),
    province: String(formData.get('province') ?? '').trim(),
    postalCode: String(formData.get('postalCode') ?? '').trim(),
    country: String(formData.get('country') ?? 'TH').trim() || 'TH',
    note: String(formData.get('note') ?? '').trim() || null,
  }
}

async function nextOrderNumber(shopId: string): Promise<string> {
  const rows = await db
    .select({ c: count() })
    .from(orders)
    .where(eq(orders.shopId, shopId))
  const c = rows[0]?.c ?? 0
  return String(1000 + Number(c))
}

export async function placeOrder(formData: FormData): Promise<CheckoutResult> {
  const shop = await requireShopFromHost()
  const cart = await getCartByToken(shop.id)
  if (!cart) return { ok: false, error: 'ไม่พบตะกร้า' }

  const input = readForm(formData)
  if (!input.email || !input.email.includes('@')) {
    return { ok: false, error: 'กรุณากรอกอีเมลที่ถูกต้อง' }
  }
  if (!input.firstName) return { ok: false, error: 'กรุณากรอกชื่อ' }
  if (!input.address1) return { ok: false, error: 'กรุณากรอกที่อยู่' }
  if (!input.city) return { ok: false, error: 'กรุณากรอกเมือง/อำเภอ' }
  if (!input.postalCode) return { ok: false, error: 'กรุณากรอกรหัสไปรษณีย์' }

  // Load cart lines + snapshot prices
  const lines = await db
    .select({
      itemId: cartItems.id,
      quantity: cartItems.quantity,
      variantId: productVariants.id,
      variantTitle: productVariants.title,
      variantSku: productVariants.sku,
      variantPrice: productVariants.price,
      requiresShipping: productVariants.requiresShipping,
      productTitle: products.title,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(cartItems.cartId, cart.id))

  if (lines.length === 0) return { ok: false, error: 'ตะกร้าว่าง' }

  // Compute totals — MVP: ไม่คิดภาษี ไม่คิดค่าส่ง (จะมาใน phase ถัดไป)
  const subtotal = lines.reduce((s, l) => s + Number(l.variantPrice) * l.quantity, 0)
  const totalTax = 0
  const totalShipping = 0
  const totalDiscounts = 0
  const total = subtotal + totalTax + totalShipping - totalDiscounts

  const shippingAddress = {
    firstName: input.firstName,
    lastName: input.lastName,
    address1: input.address1,
    address2: input.address2,
    city: input.city,
    province: input.province,
    postalCode: input.postalCode,
    country: input.country,
    phone: input.phone,
  }

  let orderNumber: string | null = null
  let trackingToken: string | null = null
  let orderId: string | null = null

  // Retry on order_number unique collision (race-condition guard)
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = String(Number(await nextOrderNumber(shop.id)) + attempt)
    const token = randomToken()

    try {
      const result = await db.transaction(async (tx) => {
        const [order] = await tx
          .insert(orders)
          .values({
            shopId: shop.id,
            orderNumber: candidate,
            trackingToken: token,
            email: input.email,
            phone: input.phone,
            currency: shop.currency,
            subtotalPrice: subtotal.toFixed(2),
            totalDiscounts: totalDiscounts.toFixed(2),
            totalShipping: totalShipping.toFixed(2),
            totalTax: totalTax.toFixed(2),
            totalPrice: total.toFixed(2),
            financialStatus: 'pending',
            fulfillmentStatus: 'unfulfilled',
            status: 'open',
            shippingAddress,
            billingAddress: shippingAddress,
          })
          .returning({ id: orders.id })
        if (!order) throw new Error('insert order failed')

        await tx.insert(orderLineItems).values(
          lines.map((l) => ({
            orderId: order.id,
            shopId: shop.id,
            variantId: l.variantId,
            productTitle: l.productTitle,
            variantTitle: l.variantTitle,
            sku: l.variantSku,
            quantity: l.quantity,
            price: l.variantPrice,
            requiresShipping: l.requiresShipping,
          })),
        )

        // Empty cart — soft expire (ตรงนี้ ลบ items + mark cart expired)
        await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id))
        await tx
          .update(carts)
          .set({ expiresAt: new Date() })
          .where(eq(carts.id, cart.id))

        return { id: order.id }
      })

      orderId = result.id
      orderNumber = candidate
      trackingToken = token
      break
    } catch (error) {
      // 23505 = unique violation (order_number ซ้ำ) → retry
      if ((error as { code?: string })?.code !== '23505') throw error
    }
  }

  if (!orderNumber || !trackingToken) {
    return { ok: false, error: 'สร้างออเดอร์ไม่สำเร็จ ลองใหม่อีกครั้ง' }
  }

  // Clear cart cookie
  const store = await cookies()
  store.delete(CART_COOKIE)

  redirect(`/orders/${orderNumber}?token=${trackingToken}`)
}
