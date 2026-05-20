import { and, asc, desc, eq, inArray, isNull, ne, sql } from '@pipecommerce/db'
import {
  productImages,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import { db } from '@/lib/db.ts'
import { ProductCard, type ProductCardData } from '@/app/_components/product-card.tsx'

/**
 * Related products — pick by:
 *   1. Same tags (top priority — overlap count)
 *   2. Fallback: same shop, newest
 *
 * Excludes the current product. Cap 4.
 */
export async function RelatedProducts({
  shopId,
  shopCurrency,
  productId,
  tags,
}: {
  shopId: string
  shopCurrency: string
  productId: string
  tags: string[]
}) {
  // 1. By tag overlap (if any tags)
  let related: Array<{
    id: string
    handle: string
    title: string
    price: string
  }> = []

  if (tags.length > 0) {
    related = await db
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
          ne(products.id, productId),
          sql`${products.tags} && ${tags}`,
        ),
      )
      .orderBy(desc(products.publishedAt))
      .limit(4)
  }

  // 2. Fallback to newest if not enough by tag
  if (related.length < 4) {
    const needed = 4 - related.length
    const haveIds = new Set(related.map((r) => r.id))
    const fallback = await db
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
          ne(products.id, productId),
        ),
      )
      .orderBy(desc(products.publishedAt))
      .limit(needed + related.length) // extra in case of overlap
    for (const f of fallback) {
      if (haveIds.has(f.id)) continue
      related.push(f)
      if (related.length >= 4) break
    }
  }

  if (related.length === 0) return null

  // Fetch cover image per product
  const productIds = related.map((r) => r.id)
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

  const cards: ProductCardData[] = related.map((r) => ({
    handle: r.handle,
    title: r.title,
    price: r.price ?? '0',
    currency: shopCurrency,
    imageR2Key: coverByProduct.get(r.id) ?? null,
  }))

  return (
    <section className="border-t pt-8">
      <h2 className="mb-4 text-xl font-semibold">สินค้าที่เกี่ยวข้อง</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <ProductCard key={c.handle} product={c} />
        ))}
      </div>
    </section>
  )
}
