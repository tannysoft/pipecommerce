import { and, count, desc, eq, isNull } from '@pipecommerce/db'
import { galleries, galleryImages } from '@pipecommerce/db/schema'
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

export default async function GalleriesListPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const list = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      handle: galleries.handle,
      status: galleries.status,
      imageCount: count(galleryImages.id),
    })
    .from(galleries)
    .leftJoin(
      galleryImages,
      and(eq(galleryImages.galleryId, galleries.id), isNull(galleryImages.deletedAt)),
    )
    .where(and(eq(galleries.shopId, shop.id), isNull(galleries.deletedAt)))
    .groupBy(galleries.id)
    .orderBy(desc(galleries.createdAt))
    .limit(50)

  if (list.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Galleries</CardTitle>
          <CardDescription>
            Image galleries — portfolio, look book, behind-the-scenes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/${shop.slug}/galleries/new`}>
            <Button>+ สร้าง Gallery</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Galleries</h2>
        <Link href={`/${shop.slug}/galleries/new`}>
          <Button>+ สร้าง Gallery</Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Images</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((g) => (
              <TableRow key={g.id}>
                <TableCell>
                  <Link
                    href={`/${shop.slug}/galleries/${g.id}`}
                    className="font-medium hover:underline"
                  >
                    {g.title}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  /galleries/{g.handle}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[g.status] ?? STATUS_BADGE.draft}`}
                  >
                    {g.status}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{g.imageCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
