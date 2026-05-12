import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import { AnalyticsForm } from './analytics-form.tsx'

export const metadata = { title: 'Analytics' }

export default async function AnalyticsSettingsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)
  const analytics = shop.settings.analytics ?? {}

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/${shopSlug}/settings`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Settings
        </Link>
        <h2 className="mt-1 text-2xl font-bold">Analytics</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tracking pixels</CardTitle>
          <CardDescription>
            ติดตั้ง Google Analytics + Meta Pixel ใน storefront ของร้าน · เก็บข้อมูล
            page view + add to cart + purchase events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnalyticsForm
            shopSlug={shopSlug}
            initial={{
              ga4MeasurementId: analytics.ga4MeasurementId ?? null,
              metaPixelId: analytics.metaPixelId ?? null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
