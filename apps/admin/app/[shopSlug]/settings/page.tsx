import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'

const settingsLinks = [
  {
    href: 'typography',
    title: 'Typography',
    description: 'เลือก font ของ storefront — heading + body (Google Fonts ฟรี)',
  },
  {
    href: 'members',
    title: 'Members',
    description: 'เพิ่ม/ลบคนที่ช่วยจัดการร้าน + ตั้ง role',
  },
  {
    href: 'tax',
    title: 'Tax',
    description: 'ตั้งค่าภาษี (VAT) — 3 modes: inclusive / exclusive / shop absorbs',
  },
  {
    href: 'shipping',
    title: 'Shipping',
    description: 'ค่าส่ง flat rate + free threshold',
  },
  {
    href: 'announcement-bar',
    title: 'Announcement Bar',
    description: 'แถบประกาศด้านบน storefront — โปรโมชั่น ส่งฟรี ฯลฯ',
  },
]

export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  await requireShop(shopSlug)

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Settings</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {settingsLinks.map((s) => (
          <Link key={s.href} href={`/${shopSlug}/settings/${s.href}`}>
            <Card className="transition hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
