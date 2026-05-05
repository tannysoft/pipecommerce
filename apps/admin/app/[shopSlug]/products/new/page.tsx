import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import { NewProductForm } from './new-product-form.tsx'

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  await requireShop(shopSlug) // gate

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href={`/${shopSlug}/products`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไปรายการสินค้า
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>สร้างสินค้าใหม่</CardTitle>
        </CardHeader>
        <CardContent>
          <NewProductForm shopSlug={shopSlug} />
        </CardContent>
      </Card>
    </div>
  )
}
