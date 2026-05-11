import { eq } from '@pipecommerce/db'
import { shopAnnouncementBars } from '@pipecommerce/db/schema'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { AnnouncementBarForm } from './announcement-bar-form.tsx'

type StoredMessage = { text?: string; link?: string | null; link_text?: string | null }

export default async function AnnouncementBarSettingsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const [bar] = await db
    .select()
    .from(shopAnnouncementBars)
    .where(eq(shopAnnouncementBars.shopId, shop.id))
    .limit(1)

  const messages = (bar?.messages as StoredMessage[] | null) ?? []
  const first = messages[0] ?? {}

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${shopSlug}/settings`} className="hover:underline">
          ← Settings
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Announcement Bar</CardTitle>
          <CardDescription>
            แถบประกาศด้านบนสุดของ storefront — เช่น โปรโมชั่น ส่งฟรี ประกาศปิดร้านชั่วคราว
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementBarForm
            shopSlug={shopSlug}
            defaults={{
              isActive: bar?.isActive ?? false,
              isDismissible: bar?.isDismissible ?? true,
              text: first.text ?? '',
              link: first.link ?? '',
              linkText: first.link_text ?? '',
              backgroundColor: bar?.backgroundColor ?? '',
              textColor: bar?.textColor ?? '',
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
