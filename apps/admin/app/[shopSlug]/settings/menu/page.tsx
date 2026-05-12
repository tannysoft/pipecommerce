import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import { MenuForm } from './menu-form.tsx'

export const metadata = { title: 'เมนูร้าน' }

export default async function MenuSettingsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)
  const items = shop.settings.menu ?? []

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/${shopSlug}/settings`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Settings
        </Link>
        <h2 className="mt-1 text-2xl font-bold">เมนูร้าน</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">เมนูใน header</CardTitle>
          <CardDescription>
            ลิงก์ที่ลูกค้าเห็นบน storefront header · ลำดับซ้าย→ขวา (mobile = บน→ล่าง)
            · ถ้าเว้นว่างจะแสดงค่า default (สินค้า / คอลเลกชัน / บทความ)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MenuForm shopSlug={shopSlug} initialItems={items} />
        </CardContent>
      </Card>
    </div>
  )
}
