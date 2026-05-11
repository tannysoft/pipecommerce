import { and, asc, eq, isNull, sum } from '@pipecommerce/db'
import {
  inventoryItems,
  productImages,
  productOptions,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { publicImageUrl } from '@/lib/image.ts'
import { requireShopFromHost } from '@/lib/shop.ts'
import { AddToCartButton } from './add-to-cart-button.tsx'
import { VariantSelector } from './variant-selector.tsx'

const fmtBaht = (raw: string) =>
  Number(raw).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const shop = await requireShopFromHost()

  const [product] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.shopId, shop.id),
        eq(products.handle, handle),
        eq(products.status, 'active'),
        isNull(products.deletedAt),
      ),
    )
    .limit(1)

  if (!product) notFound()

  const [variants, images, options, stocks] = await Promise.all([
    db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id))
      .orderBy(productVariants.position),
    db
      .select({
        id: productImages.id,
        r2KeyOrig: productImages.r2KeyOrig,
        alt: productImages.alt,
      })
      .from(productImages)
      .where(and(eq(productImages.productId, product.id), isNull(productImages.deletedAt)))
      .orderBy(asc(productImages.position), asc(productImages.createdAt)),
    db
      .select({ name: productOptions.name, values: productOptions.values })
      .from(productOptions)
      .where(eq(productOptions.productId, product.id))
      .orderBy(asc(productOptions.position)),
    db
      .select({
        variantId: inventoryItems.variantId,
        total: sum(inventoryItems.available).mapWith(Number),
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.shopId, shop.id))
      .groupBy(inventoryItems.variantId),
  ])

  const stockByVariant = new Map(stocks.map((s) => [s.variantId, s.total]))

  const minPrice = variants.length
    ? variants
        .map((v) => Number(v.price))
        .reduce((a, b) => Math.min(a, b))
    : 0

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <Link
        href="/products"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← สินค้าทั้งหมด
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-2">
          {images.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicImageUrl(images[0]!.r2KeyOrig)}
                alt={images[0]!.alt ?? product.title}
                className="aspect-square w-full rounded-xl border object-cover"
              />
              {images.length > 1 ? (
                <div className="grid grid-cols-4 gap-2">
                  {images.slice(0, 4).map((img) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={img.id}
                      src={publicImageUrl(img.r2KeyOrig)}
                      alt={img.alt ?? product.title}
                      className="aspect-square w-full rounded-lg border object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="aspect-square rounded-xl border bg-muted" />
          )}
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold">{product.title}</h1>
          {options.length === 0 ? (
            <p className="text-2xl font-semibold">฿{fmtBaht(minPrice.toFixed(2))}</p>
          ) : null}

          {product.description ? (
            <div className="space-y-1">
              <h2 className="text-sm font-medium">รายละเอียด</h2>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {product.description}
              </p>
            </div>
          ) : null}

          {options.length > 0 ? (
            <VariantSelector
              options={options}
              variants={variants.map((v) => ({
                ...v,
                stock: stockByVariant.has(v.id) ? stockByVariant.get(v.id) ?? 0 : null,
              }))}
            />
          ) : (
            <>
              {(() => {
                const v = variants[0]
                const stock = v && stockByVariant.has(v.id) ? stockByVariant.get(v.id) ?? 0 : null
                if (stock !== null && stock <= 0) {
                  return (
                    <p className="rounded-md border bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
                      สินค้าหมด
                    </p>
                  )
                }
                return (
                  <>
                    {stock !== null && stock <= 5 ? (
                      <p className="text-xs text-orange-600">เหลือ {stock} ชิ้นเท่านั้น</p>
                    ) : null}
                    <AddToCartButton variantId={v?.id ?? ''} />
                  </>
                )
              })()}
            </>
          )}

          {product.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {product.tags.map((t) => (
                <Link
                  key={t}
                  href={`/tags/${encodeURIComponent(t)}`}
                  className="rounded-full border bg-secondary/50 px-2.5 py-0.5 text-xs hover:bg-secondary"
                >
                  #{t}
                </Link>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            handle: <span className="font-mono">{product.handle}</span>
          </p>
        </div>
      </div>
    </main>
  )
}
