import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { getOrInitTheme } from './theme-data.ts'

export default async function ThemeIndexPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const themeRow = await getOrInitTheme(shopSlug)
  const hasDraft = Boolean(themeRow.draftTemplates)

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold">Theme</h2>
        <p className="text-sm text-muted-foreground">
          Theme:{' '}
          <span className="font-mono">
            {themeRow.themeCode} · v{themeRow.themeVersion}
          </span>
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={`/${shopSlug}/theme/home`}>
          <Card className="transition hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Home page editor</CardTitle>
              <CardDescription>
                ลาก-วาง sections + ปรับการตั้งค่า · {hasDraft ? 'มี draft ค้างอยู่' : 'ตรงกับ live'}
              </CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        </Link>

        <Card className="opacity-70">
          <CardHeader>
            <CardTitle className="text-base">Collection / Product pages</CardTitle>
            <CardDescription>มาใน Phase 2 — ตอนนี้ใช้ template default</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </div>
  )
}
