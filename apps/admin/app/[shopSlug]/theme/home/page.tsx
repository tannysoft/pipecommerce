import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { defaultHomeTemplate, type HomeTemplate, type Section } from '../sections.ts'
import { getOrInitTheme } from '../theme-data.ts'
import { SectionsEditor } from './sections-editor.tsx'

export default async function ThemeHomeEditorPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const themeRow = await getOrInitTheme(shopSlug)

  // Use draft if exists, else live templates
  const draft = themeRow.draftTemplates as { home?: HomeTemplate } | null
  const live = themeRow.templates as { home?: HomeTemplate } | null
  const home: HomeTemplate =
    (draft?.home && Array.isArray(draft.home.sections)
      ? draft.home
      : live?.home && Array.isArray(live.home.sections)
        ? live.home
        : defaultHomeTemplate())
  const sections: Section[] = home.sections

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${shopSlug}/theme`} className="hover:underline">
          ← Theme
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Home page editor</CardTitle>
          <CardDescription>
            ลาก sections เพื่อเรียงใหม่ · เลือกเพื่อแก้ไข · Save draft → Publish ให้ลูกค้าเห็น
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SectionsEditor
            shopSlug={shopSlug}
            initialSections={sections}
            hasDraft={Boolean(draft?.home)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
