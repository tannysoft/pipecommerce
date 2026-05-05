import { and, eq, isNull } from '@pipecommerce/db'
import { productVariants, products } from '@pipecommerce/db/schema'
import { Button } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

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

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(productVariants.position)

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
        {/* รูปสินค้า — placeholder จนกว่า Phase 3i (image pipeline) เสร็จ */}
        <div className="aspect-square rounded-xl border bg-muted" />

        <div className="space-y-4">
          <h1 className="text-3xl font-bold">{product.title}</h1>
          <p className="text-2xl font-semibold">
            ฿{fmtBaht(minPrice.toFixed(2))}
          </p>

          {product.description ? (
            <div className="space-y-1">
              <h2 className="text-sm font-medium">รายละเอียด</h2>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {product.description}
              </p>
            </div>
          ) : null}

          {variants.length > 1 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium">เลือก variant</h2>
              <ul className="space-y-1 text-sm">
                {variants.map((v) => (
                  <li key={v.id} className="flex justify-between border-b py-1">
                    <span>{v.title}</span>
                    <span className="font-mono">฿{fmtBaht(v.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button className="w-full" disabled>
            เพิ่มลงตะกร้า (Phase ถัดไป)
          </Button>

          <p className="text-xs text-muted-foreground">
            handle: <span className="font-mono">{product.handle}</span>
          </p>
        </div>
      </div>
    </main>
  )
}
