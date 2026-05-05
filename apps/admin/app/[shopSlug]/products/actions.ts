'use server'

import { and, eq } from '@pipecommerce/db'
import { productVariants, products } from '@pipecommerce/db/schema'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export type CreateProductResult = { ok: true } | { ok: false; error: string }

export async function createProduct(
  shopSlug: string,
  formData: FormData,
): Promise<CreateProductResult> {
  const { shop } = await requireShop(shopSlug)

  const title = String(formData.get('title') ?? '').trim()
  const handle = String(formData.get('handle') ?? '').trim().toLowerCase()
  const description = String(formData.get('description') ?? '').trim() || null
  const status = String(formData.get('status') ?? 'draft')
  const priceRaw = String(formData.get('price') ?? '').trim()

  if (!title) return { ok: false, error: 'กรุณากรอกชื่อสินค้า' }
  if (handle.length < 1 || handle.length > 60) {
    return { ok: false, error: 'handle ต้องยาว 1-60 ตัว' }
  }
  if (!HANDLE_PATTERN.test(handle)) {
    return { ok: false, error: 'handle ใช้ได้เฉพาะ a-z, 0-9, -' }
  }
  if (status !== 'draft' && status !== 'active') {
    return { ok: false, error: 'status ต้องเป็น draft หรือ active' }
  }

  const price = Number(priceRaw)
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: 'ราคาต้องเป็นตัวเลข ≥ 0' }
  }

  // เช็ค handle ซ้ำในร้าน (เป็น UX-friendly check ก่อน Postgres ขึ้น 23505)
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.shopId, shop.id), eq(products.handle, handle)))
    .limit(1)
  if (existing) return { ok: false, error: 'handle นี้มีสินค้าอื่นใช้แล้ว' }

  let createdId: string
  try {
    const result = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          shopId: shop.id,
          title,
          handle,
          description,
          status,
          publishedAt: status === 'active' ? new Date() : null,
        })
        .returning({ id: products.id })

      if (!product) throw new Error('insert product failed')

      // auto-create default variant — products ไม่มี price ของตัวเอง
      // ดู docs/SCHEMA.md (ราคาอยู่ที่ product_variants)
      await tx.insert(productVariants).values({
        productId: product.id,
        shopId: shop.id,
        title: 'Default Title',
        price: price.toFixed(2),
      })

      return product
    })
    createdId = result.id
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'handle นี้มีสินค้าอื่นใช้แล้ว' }
    }
    throw error
  }

  redirect(`/${shopSlug}/products/${createdId}`)
}
