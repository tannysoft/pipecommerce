import { and, eq, isNull } from '@pipecommerce/db'
import { pages } from '@pipecommerce/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { PageEditForm } from './edit-form.tsx'

export default async function PageEditorPage({
  params,
}: {
  params: Promise<{ shopSlug: string; pageId: string }>
}) {
  const { shopSlug, pageId } = await params
  const { shop } = await requireShop(shopSlug)

  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.shopId, shop.id), isNull(pages.deletedAt)))
    .limit(1)

  if (!page) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/${shopSlug}/pages`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไปรายการ
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>แก้ไข Page</CardTitle>
        </CardHeader>
        <CardContent>
          <PageEditForm
            shopSlug={shopSlug}
            page={{
              id: page.id,
              title: page.title,
              handle: page.handle,
              body: page.body,
              status: page.status,
              seoTitle: page.seoTitle,
              seoDescription: page.seoDescription,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
