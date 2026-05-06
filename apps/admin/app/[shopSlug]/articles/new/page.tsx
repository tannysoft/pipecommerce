import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import { NewArticleForm } from './new-article-form.tsx'

export default async function NewArticlePage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  await requireShop(shopSlug)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/${shopSlug}/articles`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไปรายการ
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>เขียนบทความใหม่</CardTitle>
        </CardHeader>
        <CardContent>
          <NewArticleForm shopSlug={shopSlug} />
        </CardContent>
      </Card>
    </div>
  )
}
