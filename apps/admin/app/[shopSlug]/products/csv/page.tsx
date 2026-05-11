import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { requireShop } from '@/lib/shop.ts'
import { CsvImportForm } from './csv-import-form.tsx'

export default async function CsvPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  await requireShop(shopSlug)

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${shopSlug}/products`} className="hover:underline">
          ← Products
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Products → CSV</CardTitle>
          <CardDescription>
            ดาวน์โหลด products + variant default ในรูปแบบ Shopify-compat (subset)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href={`/${shopSlug}/products/csv/export`}
            className="inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90"
          >
            ดาวน์โหลด CSV
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Products ← CSV</CardTitle>
          <CardDescription>
            อัปโหลด CSV — match ด้วย Handle (มีอยู่ → update, ไม่มี → create)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            <strong>Columns ที่ต้องมี:</strong> Title, Variant Price
          </p>
          <p className="text-sm">
            <strong>Optional:</strong> Handle, Body (HTML), Tags, Published, Variant SKU, Status
          </p>
          <p className="text-xs text-muted-foreground">
            แนะนำ: export ก่อนเพื่อใช้เป็น template · 1 row = 1 product (multi-variant
            ต้อง edit ทีหลัง) · ไฟล์สูงสุด 5 MB
          </p>
          <CsvImportForm shopSlug={shopSlug} />
        </CardContent>
      </Card>
    </div>
  )
}
