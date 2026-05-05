import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop, type ShopSettings } from '@/lib/shop.ts'
import { TypographyForm } from './typography-form.tsx'

export default async function TypographySettingsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const fonts = (shop.settings as ShopSettings).fonts ?? {}

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href={`/${shopSlug}/settings`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Settings
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>
            เลือก font ที่ใช้ใน storefront — Google Fonts ทั้งหมดเป็น free OFL license
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TypographyForm
            shopSlug={shopSlug}
            initial={{
              heading: fonts.heading ?? 'noto-sans-thai',
              body: fonts.body ?? 'inter',
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
