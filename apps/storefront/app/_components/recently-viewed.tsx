import { and, asc, eq, inArray, isNull, sql } from '@pipecommerce/db'
import {
  productImages,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import { cookies } from 'next/headers'
import { db } from '@/lib/db.ts'
import { ProductCard, type ProductCardData } from './product-card.tsx'

const COOKIE_NAME = 'pc_recent'

/**
 * Render section "ดูล่าสุด" จาก cookie + DB lookup
 * Excludes `excludeHandle` (current product)
 * คืน null ถ้าไม่มี recently viewed
 */
export async function RecentlyViewed({
  shopId,
  shopCurrency,
  excludeHandle,
}: {
  shopId: string
  shopCurrency: string
  excludeHandle?: string
}) {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return null

  const handles = decodeURIComponent(raw)
    .split(',')
    .filter(Boolean)
    .filter((h) => h !== excludeHandle)
    .slice(0, 8)
  if (handles.length === 0) return null

  const rows = await db
    .select({
      id: products.id,
      handle: products.handle,
      title: products.title,
      price: sql<string>`(
        SELECT MIN(${productVariants.price})
        FROM ${productVariants}
        WHERE ${productVariants.productId} = ${products.id}
      )`,
    })
    .from(products)
    .where(
      and(
        eq(products.shopId, shopId),
        eq(products.status, 'active'),
        isNull(products.deletedAt),
        inArray(products.handle, handles),
      ),
    )
  if (rows.length === 0) return null

  // Preserve cookie order
  const byHandle = new Map(rows.map((r) => [r.handle, r]))
  const ordered = handles.map((h) => byHandle.get(h)).filter(Boolean) as typeof rows

  // Cover images
  const productIds = ordered.map((r) => r.id)
  const images = await db
    .select({
      productId: productImages.productId,
      r2Key: productImages.r2KeyOrig,
      position: productImages.position,
    })
    .from(productImages)
    .where(
      and(
        inArray(productImages.productId, productIds),
        isNull(productImages.deletedAt),
      ),
    )
    .orderBy(asc(productImages.position))
  const coverByProduct = new Map<string, string>()
  for (const img of images) {
    if (!coverByProduct.has(img.productId)) coverByProduct.set(img.productId, img.r2Key)
  }

  const cards: ProductCardData[] = ordered.map((r) => ({
    handle: r.handle,
    title: r.title,
    price: r.price ?? '0',
    currency: shopCurrency,
    imageR2Key: coverByProduct.get(r.id) ?? null,
  }))

  return (
    <section className="border-t pt-8">
      <h2 className="mb-4 text-xl font-semibold">ดูล่าสุด</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <ProductCard key={c.handle} product={c} />
        ))}
      </div>
    </section>
  )
}
