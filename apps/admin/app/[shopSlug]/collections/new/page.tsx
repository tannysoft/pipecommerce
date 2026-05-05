import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import { NewCollectionForm } from './new-collection-form.tsx'

export default async function NewCollectionPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  await requireShop(shopSlug)

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href={`/${shopSlug}/collections`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไปรายการ
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>สร้าง Collection ใหม่</CardTitle>
        </CardHeader>
        <CardContent>
          <NewCollectionForm shopSlug={shopSlug} />
        </CardContent>
      </Card>
    </div>
  )
}
