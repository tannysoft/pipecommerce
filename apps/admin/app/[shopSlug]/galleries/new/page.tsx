import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import { NewGalleryForm } from './new-gallery-form.tsx'

export default async function NewGalleryPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  await requireShop(shopSlug)

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href={`/${shopSlug}/galleries`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไปรายการ
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>สร้าง Gallery ใหม่</CardTitle>
        </CardHeader>
        <CardContent>
          <NewGalleryForm shopSlug={shopSlug} />
        </CardContent>
      </Card>
    </div>
  )
}
