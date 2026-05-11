import { and, desc, eq, inArray, isNull, min } from '@pipecommerce/db'
import { productVariants, products } from '@pipecommerce/db/schema'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pipecommerce/ui'
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
        <div className="flex items-center gap-2">
          <Link
            href={`/${shop.slug}/products/csv`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            CSV
          </Link>
          <Link href={`/${shop.slug}/products/new`}>
            <Button>+ สร้างสินค้า</Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">From price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productList.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/${shop.slug}/products/${p.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.title}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {p.handle}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[p.status] ?? STATUS_BADGE.draft}`}
                  >
                    {p.status}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {priceMap.get(p.id) ? `฿${priceMap.get(p.id)}` : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
