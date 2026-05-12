import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import { GeneralForm } from './general-form.tsx'
import { LogoUploader } from './logo-uploader.tsx'

export const metadata = { title: 'ตั้งค่าทั่วไป' }

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/${shopSlug}/settings`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Settings
        </Link>
        <h2 className="mt-1 text-2xl font-bold">ตั้งค่าทั่วไป</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">โลโก้</CardTitle>
          <CardDescription>
            แสดงใน header ของ storefront · ถ้าไม่ใส่จะแสดงชื่อร้านเป็นข้อความ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUploader shopSlug={shopSlug} currentUrl={shop.logoUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลร้าน</CardTitle>
        </CardHeader>
        <CardContent>
          <GeneralForm
            shopSlug={shopSlug}
            defaultValues={{ name: shop.name, description: shop.description }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
