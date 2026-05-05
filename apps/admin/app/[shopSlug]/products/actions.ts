'use server'

import { and, eq, isNull, ne } from '@pipecommerce/db'
import { productVariants, products } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
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

export type UpdateProductResult = { ok: true } | { ok: false; error: string }

export async function updateProduct(
  shopSlug: string,
  productId: string,
  formData: FormData,
): Promise<UpdateProductResult> {
  const { shop } = await requireShop(shopSlug)

  const title = String(formData.get('title') ?? '').trim()
  const handle = String(formData.get('handle') ?? '').trim().toLowerCase()
  const description = String(formData.get('description') ?? '').trim() || null
  const status = String(formData.get('status') ?? 'draft')
  const priceRaw = String(formData.get('price') ?? '').trim()

  if (!title) return { ok: false, error: 'กรุณากรอกชื่อสินค้า' }
  if (!HANDLE_PATTERN.test(handle) || handle.length > 60) {
    return { ok: false, error: 'handle ใช้ได้เฉพาะ a-z, 0-9, - (1-60 ตัว)' }
  }
  if (status !== 'draft' && status !== 'active' && status !== 'archived') {
    return { ok: false, error: 'status ไม่ถูกต้อง' }
  }
  const price = Number(priceRaw)
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: 'ราคาต้องเป็นตัวเลข ≥ 0' }
  }

  // verify product belong shop + ไม่ deleted
  const [existing] = await db
    .select({ id: products.id, currentStatus: products.status })
    .from(products)
    .where(
      and(eq(products.id, productId), eq(products.shopId, shop.id), isNull(products.deletedAt)),
    )
    .limit(1)
  if (!existing) return { ok: false, error: 'ไม่พบสินค้า' }

  // handle ซ้ำ (เฉพาะถ้าเปลี่ยน + กับสินค้าอื่นในร้าน)
  const [duplicate] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.shopId, shop.id),
        eq(products.handle, handle),
        ne(products.id, productId),
      ),
    )
    .limit(1)
  if (duplicate) return { ok: false, error: 'handle นี้มีสินค้าอื่นใช้แล้ว' }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({
          title,
          handle,
          description,
          status,
          publishedAt:
            status === 'active' && existing.currentStatus !== 'active' ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId))

      // MVP: 1 product = 1 default variant — update price บนทุก variant ของ product นี้
      // (variants UI proper จะมาทีหลัง)
      await tx
        .update(productVariants)
        .set({ price: price.toFixed(2), updatedAt: new Date() })
        .where(eq(productVariants.productId, productId))
    })
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'handle นี้มีสินค้าอื่นใช้แล้ว' }
    }
    throw error
  }

  revalidatePath(`/${shopSlug}/products`)
  revalidatePath(`/${shopSlug}/products/${productId}`)
  return { ok: true }
}

export async function archiveProduct(shopSlug: string, productId: string) {
  const { shop } = await requireShop(shopSlug)

  await db
    .update(products)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.shopId, shop.id)))

  revalidatePath(`/${shopSlug}/products`)
  redirect(`/${shopSlug}/products`)
}

export async function unarchiveProduct(shopSlug: string, productId: string) {
  const { shop } = await requireShop(shopSlug)

  await db
    .update(products)
    .set({ status: 'draft', updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.shopId, shop.id)))

  revalidatePath(`/${shopSlug}/products`)
  revalidatePath(`/${shopSlug}/products/${productId}`)
}
