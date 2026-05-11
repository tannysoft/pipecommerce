import { eq } from '@pipecommerce/db'
import { shopThemeSettings } from '@pipecommerce/db/schema'
import { Button } from '@pipecommerce/ui'
import Link from 'next/link'
import { SectionRenderer } from '@/app/_sections/section-renderer.tsx'
import { db } from '@/lib/db.ts'
import {
  defaultHomeTemplate,
  type HomeTemplate,
  type Section,
} from '@/lib/sections.ts'
import { lookupShopByHost, resolveShopHost } from '@/lib/shop.ts'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ theme_draft?: string }>
}) {
  const host = await resolveShopHost()
  const shop = host ? await lookupShopByHost(host) : null
  const { theme_draft: draftToken } = await searchParams

  if (!shop) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <h1 className="text-2xl font-bold">PipeCommerce</h1>
        <p className="text-muted-foreground">Multi-tenant e-commerce platform.</p>
        {host ? (
          <p className="text-sm text-destructive">
            ไม่พบร้านสำหรับ <span className="font-mono">{host}</span>
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          ทดลองใน dev: เปิด{' '}
          <span className="font-mono">{'{your-shop-slug}'}.localhost:3000</span>
        </p>
      </main>
    )
  }

  // Load theme settings — preview draft ถ้ามี ?theme_draft= matching shop
  const [themeRow] = await db
    .select()
    .from(shopThemeSettings)
    .where(eq(shopThemeSettings.shopId, shop.id))
    .limit(1)

  const showDraft = Boolean(draftToken) && Boolean(themeRow?.draftTemplates)
  const templatesRaw = showDraft
    ? (themeRow?.draftTemplates as { home?: HomeTemplate } | null)
    : (themeRow?.templates as { home?: HomeTemplate } | null)

  const homeTemplate: HomeTemplate =
    templatesRaw?.home && Array.isArray(templatesRaw.home.sections)
      ? templatesRaw.home
      : defaultHomeTemplate()

  if (homeTemplate.sections.length === 0) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 p-8 text-center">
        <h1 className="text-3xl font-bold">{shop.name}</h1>
        <p className="text-muted-foreground">
          ร้านนี้ยังไม่ได้ตั้งค่าหน้าแรก — ใช้ Theme Editor ใน admin เพื่อเริ่มต้น
        </p>
        <Link href="/products">
          <Button>เลือกซื้อสินค้าทั้งหมด</Button>
        </Link>
      </main>
    )
  }

  return (
    <>
      {showDraft ? (
        <div className="bg-yellow-100 px-4 py-2 text-center text-xs text-yellow-900">
          กำลังดู draft preview — เปลี่ยนแปลงใน Theme Editor ยังไม่ publish
        </div>
      ) : null}
      {homeTemplate.sections.map((section: Section) => (
        <SectionRenderer key={section.id} shopId={shop.id} section={section} />
      ))}
    </>
  )
}
