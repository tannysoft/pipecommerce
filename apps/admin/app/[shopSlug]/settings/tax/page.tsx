import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import type { TaxMode } from './actions.ts'
import { TaxForm } from './tax-form.tsx'

type StoredTax = {
  mode?: TaxMode
  rate?: number
  label?: string
}

export default async function TaxSettingsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const settings = (shop.settings ?? {}) as Record<string, unknown>
  const tax = (settings.tax ?? {}) as StoredTax

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${shopSlug}/settings`} className="hover:underline">
          ← Settings
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tax</CardTitle>
          <CardDescription>
            ตั้งค่าภาษีของร้าน — ใช้คำนวณตอน checkout · ดู ADR-009 (tax 3 modes)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxForm
            shopSlug={shopSlug}
            defaultValues={{
              mode: tax.mode ?? 'none',
              rate: typeof tax.rate === 'number' ? tax.rate : 0,
              label: tax.label ?? 'VAT 7%',
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
