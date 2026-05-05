import { and, eq, isNull } from '@pipecommerce/db'
import { productVariants, products } from '@pipecommerce/db/schema'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; productId: string }>
}) {
  const { shopSlug, productId } = await params
  const { shop } = await requireShop(shopSlug)

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.shopId, shop.id), isNull(products.deletedAt)))
    .limit(1)

  if (!product) notFound()

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))

  return (
    <div className="space-y-4">
      <Link
        href={`/${shopSlug}/products`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไปรายการสินค้า
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{product.title}</CardTitle>
          <CardDescription>
            <span className="font-mono">{product.handle}</span> · status: {product.status}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {product.description ? (
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-sm">{product.description}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ไม่มีคำอธิบาย</p>
          )}

          <div>
            <h3 className="text-sm font-medium">Variants ({variants.length})</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {variants.map((v) => (
                <li key={v.id} className="font-mono">
                  {v.title} — ฿{v.price}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            Edit form ทำใน Phase 3f-2 — ตอนนี้ดูข้อมูลได้อย่างเดียว
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
