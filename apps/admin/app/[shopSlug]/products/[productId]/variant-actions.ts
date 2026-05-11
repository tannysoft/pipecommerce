'use server'

import { and, asc, eq } from '@pipecommerce/db'
import {
  inventoryItems,
  productOptions,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { getOrCreateDefaultLocation } from '@/lib/inventory.ts'
import { requireShop } from '@/lib/shop.ts'

export type ActionResult = { ok: true } | { ok: false; error: string }

export type OptionInput = {
  name: string
  values: string[]
}

/**
 * บันทึก options + regenerate variants
 *
 * Algorithm:
 * 1. Cartesian product of option values → desired variants (by option1/2/3)
 * 2. Match กับ variants ปัจจุบันด้วย option keys → preserve price/sku
 * 3. Insert ใหม่, update title/position ของที่ match, ลบที่ไม่อยู่ใน matrix
 *
 * Edge: ถ้าไม่มี options เลย → 1 default variant ('Default Title')
 */
export async function saveProductOptions(
  shopSlug: string,
  productId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.shopId, shop.id)))
    .limit(1)
  if (!product) return { ok: false, error: 'ไม่พบสินค้า' }

  // Parse options from form: option1Name, option1Values, option2..., option3...
  const inputs: OptionInput[] = []
  for (let i = 1; i <= 3; i++) {
    const name = String(formData.get(`option${i}Name`) ?? '').trim()
    const valuesRaw = String(formData.get(`option${i}Values`) ?? '').trim()
    if (!name || !valuesRaw) continue
    const values = valuesRaw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    if (values.length === 0) continue
    if (values.length > 50) return { ok: false, error: `option ${i} มี value เกิน 50` }
    inputs.push({ name, values: [...new Set(values)] })
  }

  if (inputs.length > 3) return { ok: false, error: 'ตัวเลือกได้สูงสุด 3' }

  // Build Cartesian product
  const matrix: Array<[string | null, string | null, string | null]> = []
  if (inputs.length === 0) {
    matrix.push([null, null, null])
  } else {
    const dim1 = inputs[0]?.values ?? []
    const dim2 = inputs[1]?.values ?? [null]
    const dim3 = inputs[2]?.values ?? [null]
    for (const v1 of dim1) {
      for (const v2 of dim2) {
        for (const v3 of dim3) {
          matrix.push([
            v1,
            v2 as string | null,
            v3 as string | null,
          ])
        }
      }
    }
  }

  if (matrix.length > 100) {
    return { ok: false, error: 'Variants เกิน 100 — ลด values ลง' }
  }

  await db.transaction(async (tx) => {
    // Replace product_options
    await tx.delete(productOptions).where(eq(productOptions.productId, productId))
    if (inputs.length > 0) {
      await tx.insert(productOptions).values(
        inputs.map((opt, idx) => ({
          productId,
          name: opt.name,
          position: idx + 1,
          values: opt.values,
        })),
      )
    }

    // Load existing variants to preserve price/sku/etc by option key
    const existing = await tx
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(asc(productVariants.position))

    function variantKey(o1: string | null, o2: string | null, o3: string | null) {
      return `${o1 ?? ''}|${o2 ?? ''}|${o3 ?? ''}`
    }
    const existingByKey = new Map(
      existing.map((v) => [variantKey(v.option1, v.option2, v.option3), v]),
    )

    // For default-only case, also try to match the lone existing variant
    const defaultPrice =
      existing[0]?.price ?? '0.00'

    const desiredKeys = new Set(matrix.map(([a, b, c]) => variantKey(a, b, c)))

    // Delete variants ไม่อยู่ใน matrix
    for (const v of existing) {
      const key = variantKey(v.option1, v.option2, v.option3)
      if (!desiredKeys.has(key)) {
        await tx.delete(productVariants).where(eq(productVariants.id, v.id))
      }
    }

    // Upsert ตาม matrix
    for (let i = 0; i < matrix.length; i++) {
      const [o1, o2, o3] = matrix[i]!
      const key = variantKey(o1, o2, o3)
      const title =
        [o1, o2, o3].filter(Boolean).join(' / ') || 'Default Title'

      const match = existingByKey.get(key)
      if (match) {
        await tx
          .update(productVariants)
          .set({ title, position: i, option1: o1, option2: o2, option3: o3, updatedAt: new Date() })
          .where(eq(productVariants.id, match.id))
      } else {
        await tx.insert(productVariants).values({
          productId,
          shopId: shop.id,
          title,
          option1: o1,
          option2: o2,
          option3: o3,
          price: defaultPrice,
          position: i,
        })
      }
    }
  })

  revalidatePath(`/${shopSlug}/products/${productId}`)
  return { ok: true }
}

/**
 * Set inventory stock count สำหรับ variant
 *
 * value:
 *   number  → upsert inventory_items row (track stock)
 *   null    → delete inventory_items row (untracked = always available)
 *
 * ปัจจุบันใช้ default location เท่านั้น (single-location MVP)
 */
export async function setVariantStock(
  shopSlug: string,
  productId: string,
  variantId: string,
  value: number | null,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)

  // Verify variant ownership
  const [variant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.productId, productId),
        eq(productVariants.shopId, shop.id),
      ),
    )
    .limit(1)
  if (!variant) return { ok: false, error: 'ไม่พบ variant' }

  if (value !== null && (!Number.isInteger(value) || value < 0)) {
    return { ok: false, error: 'stock ต้องเป็นจำนวนเต็ม ≥ 0' }
  }

  if (value === null) {
    // Untrack — delete inventory rows for this variant
    await db.delete(inventoryItems).where(eq(inventoryItems.variantId, variantId))
  } else {
    const locationId = await getOrCreateDefaultLocation(shop.id)
    const [existing] = await db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.variantId, variantId),
          eq(inventoryItems.locationId, locationId),
        ),
      )
      .limit(1)
    if (existing) {
      await db
        .update(inventoryItems)
        .set({ available: value })
        .where(eq(inventoryItems.id, existing.id))
    } else {
      await db.insert(inventoryItems).values({
        shopId: shop.id,
        variantId,
        locationId,
        available: value,
        committed: 0,
      })
    }
  }

  revalidatePath(`/${shopSlug}/products/${productId}`)
  return { ok: true }
}

export async function updateVariant(
  shopSlug: string,
  productId: string,
  variantId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)

  const priceRaw = String(formData.get('price') ?? '').trim()
  const sku = String(formData.get('sku') ?? '').trim() || null

  const price = Number(priceRaw)
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: 'ราคาต้องเป็นตัวเลข ≥ 0' }
  }

  await db
    .update(productVariants)
    .set({ price: price.toFixed(2), sku, updatedAt: new Date() })
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.productId, productId),
        eq(productVariants.shopId, shop.id),
      ),
    )

  revalidatePath(`/${shopSlug}/products/${productId}`)
  return { ok: true }
}
