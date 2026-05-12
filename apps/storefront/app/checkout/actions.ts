'use server'

import { and, count, eq, isNull, or, sql } from '@pipecommerce/db'
import {
  cartItems,
  carts,
  discounts,
  inventoryItems,
  orderDiscountApplications,
  orderLineItems,
  orders,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createPaymentLink } from '@/lib/beam.ts'
import { CART_COOKIE, getCartByToken } from '@/lib/cart.ts'
import { db } from '@/lib/db.ts'
import { sendOrderConfirmation } from '@/lib/email.ts'
import { buildAbsoluteUrl, requireShopFromHost } from '@/lib/shop.ts'

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
    discountCode: String(formData.get('discountCode') ?? '')
      .trim()
      .toUpperCase() || null,
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

  const subtotal = lines.reduce((s, l) => s + Number(l.variantPrice) * l.quantity, 0)

  // Resolve discount code (if any)
  let appliedDiscount: {
    id: string
    code: string | null
    type: string
    value: number
    amountApplied: number
    freeShipping: boolean
  } | null = null

  if (input.discountCode) {
    const now = new Date()
    const [d] = await db
      .select()
      .from(discounts)
      .where(
        and(
          eq(discounts.shopId, shop.id),
          eq(discounts.code, input.discountCode),
          eq(discounts.status, 'active'),
        ),
      )
      .limit(1)

    if (!d) return { ok: false, error: 'รหัสส่วนลดไม่ถูกต้อง' }
    if (d.startsAt && d.startsAt > now)
      return { ok: false, error: 'รหัสส่วนลดยังไม่เริ่มใช้' }
    if (d.endsAt && d.endsAt < now) return { ok: false, error: 'รหัสส่วนลดหมดอายุแล้ว' }
    if (d.usageLimit !== null && d.usedCount >= d.usageLimit)
      return { ok: false, error: 'รหัสส่วนลดถูกใช้ครบแล้ว' }
    if (d.minimumAmount && subtotal < Number(d.minimumAmount))
      return {
        ok: false,
        error: `ต้องสั่งซื้อขั้นต่ำ ฿${Number(d.minimumAmount).toLocaleString('th-TH')}`,
      }

    let amount = 0
    let freeShipping = false
    if (d.type === 'percentage' && d.value) {
      amount = (subtotal * Number(d.value)) / 100
    } else if (d.type === 'fixed_amount' && d.value) {
      amount = Math.min(Number(d.value), subtotal)
    } else if (d.type === 'free_shipping') {
      freeShipping = true
    }

    appliedDiscount = {
      id: d.id,
      code: d.code,
      type: d.type,
      value: Number(d.value ?? 0),
      amountApplied: amount,
      freeShipping,
    }
  }

  const totalDiscounts = appliedDiscount?.amountApplied ?? 0

  const shippingConfig = (shop.settings?.shipping ?? {}) as {
    defaultRate?: number
    freeThreshold?: number | null
  }
  const baseRate =
    typeof shippingConfig.defaultRate === 'number' ? shippingConfig.defaultRate : 0
  const threshold =
    typeof shippingConfig.freeThreshold === 'number' ? shippingConfig.freeThreshold : null
  const totalShipping = appliedDiscount?.freeShipping
    ? 0
    : threshold !== null && subtotal >= threshold
      ? 0
      : baseRate

  const taxConfig = (shop.settings?.tax ?? {}) as {
    mode?: 'none' | 'inclusive_customer' | 'exclusive_customer' | 'shop_absorbs'
    rate?: number
  }
  const taxMode = taxConfig.mode ?? 'none'
  const taxRate =
    typeof taxConfig.rate === 'number' && taxConfig.rate >= 0 ? taxConfig.rate : 0

  // Tax base = subtotal หลังหัก discount
  const taxableBase = subtotal - totalDiscounts
  let totalTax = 0
  let total = taxableBase + totalShipping
  if (taxMode === 'exclusive_customer' && taxRate > 0) {
    totalTax = taxableBase * taxRate
    total = taxableBase + totalTax + totalShipping
  } else if (taxMode === 'inclusive_customer' && taxRate > 0) {
    totalTax = taxableBase - taxableBase / (1 + taxRate)
    total = taxableBase + totalShipping
  }
  // shop_absorbs และ none: totalTax = 0 ในใบเสร็จลูกค้า

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

        // Atomic stock decrement — block oversell ผ่าน WHERE available >= qty
        // ถ้า variant ไม่ track inventory จะไม่มี row → update affected = 0 → ข้าม
        // ถ้า track + ของเหลือไม่พอ → update returns 0 → throw → rollback
        for (const line of lines) {
          const updated = await tx
            .update(inventoryItems)
            .set({ available: sql`${inventoryItems.available} - ${line.quantity}` })
            .where(
              and(
                eq(inventoryItems.variantId, line.variantId),
                sql`${inventoryItems.available} >= ${line.quantity}`,
              ),
            )
            .returning({ id: inventoryItems.id })

          // Check if variant is tracked (has any inventory row)
          const tracked = await tx
            .select({ id: inventoryItems.id })
            .from(inventoryItems)
            .where(eq(inventoryItems.variantId, line.variantId))
            .limit(1)

          if (tracked.length > 0 && updated.length === 0) {
            throw new Error(`OUT_OF_STOCK:${line.variantTitle ?? line.productTitle}`)
          }
        }

        if (appliedDiscount) {
          await tx.insert(orderDiscountApplications).values({
            orderId: order.id,
            discountId: appliedDiscount.id,
            code: appliedDiscount.code,
            type: appliedDiscount.type,
            value: appliedDiscount.value.toFixed(2),
            amountApplied: appliedDiscount.amountApplied.toFixed(2),
          })
          await tx
            .update(discounts)
            .set({ usedCount: sql`${discounts.usedCount} + 1` })
            .where(eq(discounts.id, appliedDiscount.id))
        }

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
      const message = (error as { message?: string })?.message ?? ''
      if (message.startsWith('OUT_OF_STOCK:')) {
        const item = message.slice('OUT_OF_STOCK:'.length)
        return { ok: false, error: `สินค้าหมด: ${item}` }
      }
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

  // Build payment link via Beam (stub mode = redirect to internal /pay page)
  const trackingUrl = await buildAbsoluteUrl(
    `/orders/${orderNumber}?token=${trackingToken}`,
  )
  const webhookUrl = await buildAbsoluteUrl('/api/webhooks/beam')

  // Order confirmation email — fire-and-forget (don't block checkout if email fails)
  try {
    await sendOrderConfirmation({
      to: input.email,
      shop: { name: shop.name, currency: shop.currency },
      order: {
        orderNumber,
        subtotalPrice: subtotal,
        totalDiscounts,
        totalShipping,
        totalTax,
        totalPrice: total,
      },
      lines: lines.map((l) => ({
        productTitle: l.productTitle,
        variantTitle: l.variantTitle,
        quantity: l.quantity,
        price: l.variantPrice,
      })),
      trackingUrl,
    })
  } catch (error) {
    console.error('[checkout] order confirmation email failed', error)
  }

  const paymentLink = await createPaymentLink({
    amount: total,
    currency: shop.currency,
    reference: orderId!,
    orderNumber,
    description: `Order #${orderNumber} — ${shop.name}`,
    returnUrl: trackingUrl,
    webhookUrl,
  })

  redirect(paymentLink.url)
}
