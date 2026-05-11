'use server'

import { and, eq, sum } from '@pipecommerce/db'
import {
  cartItems,
  inventoryItems,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { getCartByToken, getOrCreateCart } from '@/lib/cart.ts'
import { db } from '@/lib/db.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

/**
 * Total available stock สำหรับ variant (sum across locations)
 * Returns null ถ้าไม่ track inventory (ขายได้เสมอ)
 */
async function getVariantStock(variantId: string): Promise<number | null> {
  const rows = await db
    .select({ total: sum(inventoryItems.available).mapWith(Number) })
    .from(inventoryItems)
    .where(eq(inventoryItems.variantId, variantId))
  if (rows.length === 0) return null
  const total = rows[0]?.total
  return typeof total === 'number' ? total : null
}

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

  const stock = await getVariantStock(variantId)
  const desiredQty = existingLine
    ? Math.min(MAX_QTY, existingLine.qty + qty)
    : Math.min(MAX_QTY, qty)
  if (stock !== null && desiredQty > stock) {
    if (stock <= 0) return { ok: false, error: 'สินค้าหมด' }
    return { ok: false, error: `เหลือเพียง ${stock} ชิ้น` }
  }

  if (existingLine) {
    await db
      .update(cartItems)
      .set({ quantity: desiredQty })
      .where(eq(cartItems.id, existingLine.id))
  } else {
    await db.insert(cartItems).values({ cartId: cart.id, variantId, quantity: desiredQty })
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

    // Stock check ตอน update qty ด้วย (เผื่อ stock ลดหลัง add)
    const [line] = await db
      .select({ variantId: cartItems.variantId })
      .from(cartItems)
      .where(eq(cartItems.id, item.id))
      .limit(1)
    if (line) {
      const stock = await getVariantStock(line.variantId)
      if (stock !== null && clamped > stock) {
        return {
          ok: false,
          error: stock <= 0 ? 'สินค้าหมด' : `เหลือเพียง ${stock} ชิ้น`,
        }
      }
    }

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
