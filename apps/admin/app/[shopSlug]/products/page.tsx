import { and, desc, eq, inArray, isNull, min } from '@pipecommerce/db'
import { productVariants, products } from '@pipecommerce/db/schema'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-700',
  archived: 'bg-yellow-100 text-yellow-700',
}

export default async function ProductsListPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const productList = await db
    .select({
      id: products.id,
      title: products.title,
      handle: products.handle,
      status: products.status,
      createdAt: products.createdAt,
    })
    .from(products)
    .where(and(eq(products.shopId, shop.id), isNull(products.deletedAt)))
    .orderBy(desc(products.createdAt))
    .limit(50)

  // min variant price (from-price) — second roundtrip but query stays simple
  const ids = productList.map((p) => p.id)
  const priceRows = ids.length
    ? await db
        .select({
          productId: productVariants.productId,
          fromPrice: min(productVariants.price),
        })
        .from(productVariants)
        .where(inArray(productVariants.productId, ids))
        .groupBy(productVariants.productId)
    : []
  const priceMap = new Map(priceRows.map((r) => [r.productId, r.fromPrice]))

  if (productList.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>ยังไม่มีสินค้า — เริ่มสร้างสินค้าแรกของร้าน</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/${shop.slug}/products/new`}>
            <Button>+ สร้างสินค้า</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Products</h2>
        <Link href={`/${shop.slug}/products/new`}>
          <Button>+ สร้างสินค้า</Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Handle</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">From price</th>
            </tr>
          </thead>
          <tbody>
            {productList.map((p) => (
              <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="px-4 py-2">
                  <Link href={`/${shop.slug}/products/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{p.handle}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[p.status] ?? STATUS_BADGE.draft}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {priceMap.get(p.id) ? `฿${priceMap.get(p.id)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
