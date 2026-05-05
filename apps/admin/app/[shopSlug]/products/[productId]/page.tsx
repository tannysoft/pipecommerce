import { and, eq, isNull } from '@pipecommerce/db'
import { productVariants, products } from '@pipecommerce/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { ProductEditForm } from './edit-form.tsx'

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

  const [variant] = await db
    .select({ price: productVariants.price })
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .limit(1)

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href={`/${shopSlug}/products`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไปรายการสินค้า
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>แก้ไขสินค้า</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductEditForm
            shopSlug={shopSlug}
            product={{
              id: product.id,
              title: product.title,
              handle: product.handle,
              description: product.description,
              status: product.status,
            }}
            price={variant?.price ?? null}
          />
        </CardContent>
      </Card>
    </div>
  )
}
