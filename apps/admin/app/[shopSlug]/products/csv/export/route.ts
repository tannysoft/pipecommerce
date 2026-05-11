import { and, asc, eq, isNull } from '@pipecommerce/db'
import { productVariants, products } from '@pipecommerce/db/schema'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> },
) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const rows = await db
    .select({
      handle: products.handle,
      title: products.title,
      description: products.description,
      tags: products.tags,
      status: products.status,
      sku: productVariants.sku,
      price: productVariants.price,
    })
    .from(products)
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(and(eq(products.shopId, shop.id), isNull(products.deletedAt)))
    .orderBy(asc(products.createdAt), asc(productVariants.position))

  const header = [
    'Handle',
    'Title',
    'Body (HTML)',
    'Tags',
    'Published',
    'Variant SKU',
    'Variant Price',
    'Status',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.handle),
        csvEscape(r.title),
        csvEscape(r.description ?? ''),
        csvEscape((r.tags ?? []).join(', ')),
        csvEscape(r.status === 'active' ? 'TRUE' : 'FALSE'),
        csvEscape(r.sku ?? ''),
        csvEscape(r.price ?? ''),
        csvEscape(r.status),
      ].join(','),
    )
  }
  const body = lines.join('\n')
  const today = new Date().toISOString().slice(0, 10)

  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${shop.slug}-products-${today}.csv"`,
    },
  })
}
