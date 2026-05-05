'use server'

import { and, eq, ne } from '@pipecommerce/db'
import { collectionProducts, collections, products } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export type CollectionResult = { ok: true } | { ok: false; error: string }

export async function createCollection(
  shopSlug: string,
  formData: FormData,
): Promise<CollectionResult> {
  const { shop } = await requireShop(shopSlug)

  const title = String(formData.get('title') ?? '').trim()
  const handle = String(formData.get('handle') ?? '').trim().toLowerCase()
  const description = String(formData.get('description') ?? '').trim() || null

  if (!title) return { ok: false, error: 'กรุณากรอกชื่อ collection' }
  if (!HANDLE_PATTERN.test(handle) || handle.length > 60) {
    return { ok: false, error: 'handle ใช้ได้เฉพาะ a-z, 0-9, - (1-60 ตัว)' }
  }

  let createdId: string
  try {
    const [created] = await db
      .insert(collections)
      .values({ shopId: shop.id, title, handle, description, type: 'manual' })
      .returning({ id: collections.id })
    if (!created) throw new Error('insert collection failed')
    createdId = created.id
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'handle นี้มีอีก collection ใช้แล้ว' }
    }
    throw error
  }

  redirect(`/${shopSlug}/collections/${createdId}`)
}

export async function updateCollection(
  shopSlug: string,
  collectionId: string,
  formData: FormData,
): Promise<CollectionResult> {
  const { shop } = await requireShop(shopSlug)

  const title = String(formData.get('title') ?? '').trim()
  const handle = String(formData.get('handle') ?? '').trim().toLowerCase()
  const description = String(formData.get('description') ?? '').trim() || null

  if (!title) return { ok: false, error: 'กรุณากรอกชื่อ collection' }
  if (!HANDLE_PATTERN.test(handle) || handle.length > 60) {
    return { ok: false, error: 'handle ไม่ถูกต้อง' }
  }

  // verify ownership
  const [existing] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.shopId, shop.id)))
    .limit(1)
  if (!existing) return { ok: false, error: 'ไม่พบ collection' }

  // handle ซ้ำกับ collection อื่น
  const [duplicate] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.shopId, shop.id),
        eq(collections.handle, handle),
        ne(collections.id, collectionId),
      ),
    )
    .limit(1)
  if (duplicate) return { ok: false, error: 'handle ซ้ำ' }

  try {
    await db
      .update(collections)
      .set({ title, handle, description, updatedAt: new Date() })
      .where(eq(collections.id, collectionId))
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'handle ซ้ำ' }
    }
    throw error
  }

  revalidatePath(`/${shopSlug}/collections`)
  revalidatePath(`/${shopSlug}/collections/${collectionId}`)
  return { ok: true }
}

export async function deleteCollection(shopSlug: string, collectionId: string) {
  const { shop } = await requireShop(shopSlug)

  // FK ON DELETE CASCADE บน collection_products → ลบ junction อัตโนมัติ
  await db
    .delete(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.shopId, shop.id)))

  revalidatePath(`/${shopSlug}/collections`)
  redirect(`/${shopSlug}/collections`)
}

/**
 * Form-bound server action — return void เพื่อให้ใช้ตรงๆ กับ <form action>
 *
 * Race-condition note: dropdown filter ออก products ที่อยู่ใน collection
 * แล้ว ดังนั้น 23505 (unique violation) เกิดเฉพาะ concurrent submit
 * → silently ignore
 */
export async function addProductToCollection(
  shopSlug: string,
  collectionId: string,
  formData: FormData,
): Promise<void> {
  const { shop } = await requireShop(shopSlug)
  const productId = String(formData.get('productId') ?? '').trim()
  if (!productId) return

  const [coll] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.shopId, shop.id)))
    .limit(1)
  if (!coll) return

  const [prod] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.shopId, shop.id)))
    .limit(1)
  if (!prod) return

  try {
    await db.insert(collectionProducts).values({ collectionId, productId, position: 0 })
  } catch (error) {
    if ((error as { code?: string })?.code !== '23505') throw error
  }

  revalidatePath(`/${shopSlug}/collections/${collectionId}`)
}

export async function removeProductFromCollection(
  shopSlug: string,
  collectionId: string,
  productId: string,
) {
  const { shop } = await requireShop(shopSlug)
  // verify collection ownership
  const [coll] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.shopId, shop.id)))
    .limit(1)
  if (!coll) return

  await db
    .delete(collectionProducts)
    .where(
      and(
        eq(collectionProducts.collectionId, collectionId),
        eq(collectionProducts.productId, productId),
      ),
    )

  revalidatePath(`/${shopSlug}/collections/${collectionId}`)
}
