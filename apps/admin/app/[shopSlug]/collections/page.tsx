import { count, desc, eq } from '@pipecommerce/db'
import { collectionProducts, collections } from '@pipecommerce/db/schema'
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Products</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/${shop.slug}/collections/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.title}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {c.handle}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.type}</TableCell>
                <TableCell className="text-right tabular-nums">{c.productCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
