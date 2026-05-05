import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import { NewPageForm } from './new-page-form.tsx'

export default async function NewPagePage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  await requireShop(shopSlug)

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
          <CardTitle>สร้าง Page ใหม่</CardTitle>
        </CardHeader>
        <CardContent>
          <NewPageForm shopSlug={shopSlug} />
        </CardContent>
      </Card>
    </div>
  )
}
