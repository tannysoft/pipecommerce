import { and, desc, eq, isNull } from '@pipecommerce/db'
import { articles } from '@pipecommerce/db/schema'
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

export default async function ArticlesListPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const list = await db
    .select({
      id: articles.id,
      title: articles.title,
      handle: articles.handle,
      status: articles.status,
      authorName: articles.authorName,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(and(eq(articles.shopId, shop.id), isNull(articles.deletedAt)))
    .orderBy(desc(articles.createdAt))
    .limit(50)

  if (list.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Articles</CardTitle>
          <CardDescription>บทความ + ข่าวสาร — ตอนนี้ยังไม่มี</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/${shop.slug}/articles/new`}>
            <Button>+ เขียนบทความ</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Articles</h2>
        <Link href={`/${shop.slug}/articles/new`}>
          <Button>+ เขียนบทความ</Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link
                    href={`/${shop.slug}/articles/${a.id}`}
                    className="font-medium hover:underline"
                  >
                    {a.title}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground">/blog/{a.handle}</p>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.authorName ?? '—'}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[a.status] ?? STATUS_BADGE.draft}`}
                  >
                    {a.status}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('th-TH') : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
