import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import { ShippingForm } from './shipping-form.tsx'

type StoredShipping = { defaultRate?: number; freeThreshold?: number | null }

export default async function ShippingSettingsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const settings = (shop.settings ?? {}) as Record<string, unknown>
  const shipping = (settings.shipping ?? {}) as StoredShipping

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${shopSlug}/settings`} className="hover:underline">
          ← Settings
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipping</CardTitle>
          <CardDescription>
            ตั้งค่าส่งแบบเรียบง่าย — flat rate + free threshold (per-zone จะมา P2)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShippingForm
            shopSlug={shopSlug}
            defaultValues={{
              defaultRate:
                typeof shipping.defaultRate === 'number' ? shipping.defaultRate : 0,
              freeThreshold:
                typeof shipping.freeThreshold === 'number' ? shipping.freeThreshold : null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
