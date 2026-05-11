import { and, eq } from '@pipecommerce/db'
import { discounts } from '@pipecommerce/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { DiscountForm } from '../discount-form.tsx'

type FormStatus = 'active' | 'disabled' | 'scheduled'
type FormType = 'percentage' | 'fixed_amount' | 'free_shipping'

function toLocalInput(d: Date | null): string {
  if (!d) return ''
  // YYYY-MM-DDTHH:mm format for datetime-local
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default async function EditDiscountPage({
  params,
}: {
  params: Promise<{ shopSlug: string; discountId: string }>
}) {
  const { shopSlug, discountId } = await params
  const { shop } = await requireShop(shopSlug)

  const [d] = await db
    .select()
    .from(discounts)
    .where(and(eq(discounts.id, discountId), eq(discounts.shopId, shop.id)))
    .limit(1)
  if (!d) notFound()

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${shopSlug}/discounts`} className="hover:underline">
          ← Discounts
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{d.title}</CardTitle>
          <p className="text-xs text-muted-foreground">
            ใช้ไปแล้ว {d.usedCount}
            {d.usageLimit ? ` / ${d.usageLimit}` : ''}
          </p>
        </CardHeader>
        <CardContent>
          <DiscountForm
            shopSlug={shopSlug}
            mode="edit"
            discountId={d.id}
            defaultValues={{
              code: d.code ?? '',
              title: d.title,
              type: (['percentage', 'fixed_amount', 'free_shipping'].includes(d.type)
                ? d.type
                : 'percentage') as FormType,
              value: d.value ?? '',
              minimumAmount: d.minimumAmount ?? '',
              usageLimit: d.usageLimit !== null ? String(d.usageLimit) : '',
              startsAt: toLocalInput(d.startsAt),
              endsAt: toLocalInput(d.endsAt),
              status: (['active', 'disabled', 'scheduled'].includes(d.status)
                ? d.status
                : 'disabled') as FormStatus,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
