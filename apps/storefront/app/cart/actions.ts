'use server'

import { and, eq } from '@pipecommerce/db'
import { cartItems, productVariants, products } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { getCartByToken, getOrCreateCart } from '@/lib/cart.ts'
import { db } from '@/lib/db.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

const MAX_QTY = 99

export type CartActionResult = { ok: true } | { ok: false; error: string }

export async function addToCart(formData: FormData): Promise<CartActionResult> {
  const shop = await requireShopFromHost()
  const variantId = String(formData.get('variantId') ?? '')
  const qty = Math.max(1, Math.min(MAX_QTY, Number(formData.get('quantity') ?? 1)))

  if (!variantId) return { ok: false, error: 'no variant' }

  // Verify variant belongs to shop + product is active
  const [variant] = await db
    .select({ id: productVariants.id, productId: productVariants.productId })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.shopId, shop.id),
        eq(products.status, 'active'),
      ),
    )
    .limit(1)
  if (!variant) return { ok: false, error: 'ไม่พบสินค้า' }

  const cart = await getOrCreateCart(shop.id, shop.currency)

  // ถ้ามี line ของ variant นี้อยู่แล้ว → เพิ่ม qty
  const [existingLine] = await db
    .select({ id: cartItems.id, qty: cartItems.quantity })
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)))
    .limit(1)

  if (existingLine) {
    const newQty = Math.min(MAX_QTY, existingLine.qty + qty)
    await db
      .update(cartItems)
      .set({ quantity: newQty })
      .where(eq(cartItems.id, existingLine.id))
  } else {
    await db.insert(cartItems).values({ cartId: cart.id, variantId, quantity: qty })
  }

  revalidatePath('/cart')
  return { ok: true }
}

export async function updateCartItemQty(
  itemId: string,
  qty: number,
): Promise<CartActionResult> {
  const shop = await requireShopFromHost()
  const cart = await getCartByToken(shop.id)
  if (!cart) return { ok: false, error: 'no cart' }

  // Verify item อยู่ใน cart นี้
  const [item] = await db
    .select({ id: cartItems.id })
    .from(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
    .limit(1)
  if (!item) return { ok: false, error: 'ไม่พบ' }

  if (qty <= 0) {
    await db.delete(cartItems).where(eq(cartItems.id, item.id))
  } else {
    const clamped = Math.min(MAX_QTY, qty)
    await db.update(cartItems).set({ quantity: clamped }).where(eq(cartItems.id, item.id))
  }

  revalidatePath('/cart')
  return { ok: true }
}

export async function removeCartItem(itemId: string): Promise<void> {
  const shop = await requireShopFromHost()
  const cart = await getCartByToken(shop.id)
  if (!cart) return

  await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))

  revalidatePath('/cart')
}
