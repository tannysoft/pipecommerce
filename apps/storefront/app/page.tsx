import { and, asc, desc, eq, inArray, isNull } from '@pipecommerce/db'
import { productImages, products } from '@pipecommerce/db/schema'
import { Button } from '@pipecommerce/ui'
import { headers } from 'next/headers'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { publicImageUrl } from '@/lib/image.ts'
import { lookupShopByHost } from '@/lib/shop.ts'

export default async function HomePage() {
  const h = await headers()
  const host = h.get('x-shop-host') ?? ''
  const shop = host ? await lookupShopByHost(host) : null

  if (!shop) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <h1 className="text-2xl font-bold">PipeCommerce</h1>
        <p className="text-muted-foreground">Multi-tenant e-commerce platform.</p>
        {host ? (
          <p className="text-sm text-destructive">
            ไม่พบร้านสำหรับ <span className="font-mono">{host}</span>
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          ทดลองใน dev: เปิด{' '}
          <span className="font-mono">{'{your-shop-slug}'}.localhost:3000</span>
        </p>
      </main>
    )
  }

  const featured = await db
    .select({
      id: products.id,
      title: products.title,
      handle: products.handle,
    })
    .from(products)
    .where(
      and(
        eq(products.shopId, shop.id),
        eq(products.status, 'active'),
        isNull(products.deletedAt),
      ),
    )
    .orderBy(desc(products.publishedAt))
    .limit(4)

  const featuredIds = featured.map((p) => p.id)
  const featuredImages = featuredIds.length
    ? await db
        .select({
          productId: productImages.productId,
          r2KeyOrig: productImages.r2KeyOrig,
        })
        .from(productImages)
        .where(
          and(inArray(productImages.productId, featuredIds), isNull(productImages.deletedAt)),
        )
        .orderBy(asc(productImages.productId), asc(productImages.position))
    : []
  const firstImage = new Map<string, string>()
  for (const img of featuredImages) {
    if (!firstImage.has(img.productId)) firstImage.set(img.productId, img.r2KeyOrig)
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">{shop.name}</h1>
        {shop.status === 'trial' ? (
          <p className="text-xs text-muted-foreground">trial mode</p>
        ) : null}
      </header>

      {featured.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-semibold">สินค้าใหม่</h2>
            <Link
              href="/products"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ดูทั้งหมด →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {featured.map((p) => {
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
                  <h3 className="mt-3 line-clamp-2 text-sm font-medium group-hover:text-primary">
                    {p.title}
                  </h3>
                </Link>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border bg-muted/40 p-8 text-center">
          <p className="text-muted-foreground">ยังไม่มีสินค้าวางจำหน่าย</p>
        </section>
      )}

      <section className="flex justify-center gap-2">
        <Link href="/products">
          <Button variant="outline">เลือกซื้อสินค้าทั้งหมด</Button>
        </Link>
        <Link href="/cart">
          <Button variant="ghost">ตะกร้า</Button>
        </Link>
      </section>
    </main>
  )
}
