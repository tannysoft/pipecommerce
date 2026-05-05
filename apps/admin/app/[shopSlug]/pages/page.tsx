import { and, desc, eq, isNull } from '@pipecommerce/db'
import { pages } from '@pipecommerce/db/schema'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-700',
  archived: 'bg-yellow-100 text-yellow-700',
}

export default async function PagesListPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const list = await db
    .select({
      id: pages.id,
      title: pages.title,
      handle: pages.handle,
      status: pages.status,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .where(and(eq(pages.shopId, shop.id), isNull(pages.deletedAt)))
    .orderBy(desc(pages.updatedAt))
    .limit(50)

  if (list.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <CardDescription>
            หน้า static เช่น About, Contact, FAQ, Privacy, Terms — ตอนนี้ยังไม่มี
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/${shop.slug}/pages/new`}>
            <Button>+ สร้าง Page</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Pages</h2>
        <Link href={`/${shop.slug}/pages/new`}>
          <Button>+ สร้าง Page</Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Handle</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="px-4 py-2">
                  <Link
                    href={`/${shop.slug}/pages/${p.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  /pages/{p.handle}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[p.status] ?? STATUS_BADGE.draft}`}
                  >
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
