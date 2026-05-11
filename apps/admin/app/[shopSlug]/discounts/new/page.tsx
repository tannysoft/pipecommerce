import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import { DiscountForm } from '../discount-form.tsx'

export default async function NewDiscountPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  await requireShop(shopSlug)

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${shopSlug}/discounts`} className="hover:underline">
          ← Discounts
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>สร้าง Discount</CardTitle>
        </CardHeader>
        <CardContent>
          <DiscountForm
            shopSlug={shopSlug}
            mode="create"
            defaultValues={{
              code: '',
              title: '',
              type: 'percentage',
              value: '10',
              minimumAmount: '',
              usageLimit: '',
              startsAt: '',
              endsAt: '',
              status: 'active',
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
