import { count, desc, eq } from '@pipecommerce/db'
import { collectionProducts, collections } from '@pipecommerce/db/schema'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

export default async function CollectionsListPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const list = await db
    .select({
      id: collections.id,
      title: collections.title,
      handle: collections.handle,
      type: collections.type,
      productCount: count(collectionProducts.productId),
    })
    .from(collections)
    .leftJoin(collectionProducts, eq(collectionProducts.collectionId, collections.id))
    .where(eq(collections.shopId, shop.id))
    .groupBy(collections.id)
    .orderBy(desc(collections.createdAt))
    .limit(50)

  if (list.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collections</CardTitle>
          <CardDescription>จัดกลุ่มสินค้า — ตอนนี้ยังไม่มี collection</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/${shop.slug}/collections/new`}>
            <Button>+ สร้าง Collection</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Collections</h2>
        <Link href={`/${shop.slug}/collections/new`}>
          <Button>+ สร้าง Collection</Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Handle</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 text-right font-medium">Products</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="px-4 py-2">
                  <Link
                    href={`/${shop.slug}/collections/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.title}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{c.handle}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{c.type}</td>
                <td className="px-4 py-2 text-right tabular-nums">{c.productCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
