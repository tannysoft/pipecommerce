import { and, asc, eq, inArray, isNull, min } from '@pipecommerce/db'
import {
  collectionProducts,
  collections,
  productImages,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { publicImageUrl } from '@/lib/image.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const shop = await requireShopFromHost()

  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.shopId, shop.id), eq(collections.handle, handle)))
    .limit(1)

  if (!collection) notFound()

  const productList = await db
    .select({
      id: products.id,
      title: products.title,
      handle: products.handle,
      position: collectionProducts.position,
    })
    .from(collectionProducts)
    .innerJoin(products, eq(collectionProducts.productId, products.id))
    .where(
      and(
        eq(collectionProducts.collectionId, collection.id),
        eq(products.status, 'active'),
        isNull(products.deletedAt),
      ),
    )
    .orderBy(asc(collectionProducts.position), asc(products.title))
    .limit(60)

  const ids = productList.map((p) => p.id)
  const [priceRows, imageRows] = ids.length
    ? await Promise.all([
        db
          .select({
            productId: productVariants.productId,
            fromPrice: min(productVariants.price),
          })
          .from(productVariants)
          .where(inArray(productVariants.productId, ids))
          .groupBy(productVariants.productId),
        db
          .select({
            productId: productImages.productId,
            r2KeyOrig: productImages.r2KeyOrig,
            position: productImages.position,
          })
          .from(productImages)
          .where(
            and(inArray(productImages.productId, ids), isNull(productImages.deletedAt)),
          )
          .orderBy(asc(productImages.productId), asc(productImages.position)),
      ])
    : [[], []]

  const priceMap = new Map(priceRows.map((r) => [r.productId, r.fromPrice]))
  const firstImage = new Map<string, string>()
  for (const img of imageRows) {
    if (!firstImage.has(img.productId)) firstImage.set(img.productId, img.r2KeyOrig)
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <Link
        href="/collections"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Collections
      </Link>

      <header>
        <h1 className="text-3xl font-bold">{collection.title}</h1>
        {collection.description ? (
          <p className="mt-2 text-sm text-muted-foreground">{collection.description}</p>
        ) : null}
        <p className="mt-1 text-sm text-muted-foreground">{productList.length} รายการ</p>
      </header>

      {productList.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีสินค้าใน collection นี้</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {productList.map((p) => {
            const r2Key = firstImage.get(p.id)
            return (
              <Link
                key={p.id}
                href={`/products/${p.handle}`}
                className="group rounded-xl border bg-card p-3 transition hover:shadow-md"
              >
                {r2Key ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={publicImageUrl(r2Key)}
                    alt={p.title}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="aspect-square rounded-lg bg-muted" />
                )}
                <h2 className="mt-3 line-clamp-2 text-sm font-medium group-hover:text-primary">
                  {p.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  ฿{priceMap.get(p.id) ?? '—'}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
