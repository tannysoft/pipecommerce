import { and, asc, eq, isNull, sum } from '@pipecommerce/db'
import {
  inventoryItems,
  productImages,
  productOptions,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { publicImageUrl } from '@/lib/r2.ts'
import { requireShop } from '@/lib/shop.ts'
import { ProductEditForm } from './edit-form.tsx'
import { ImageUploader } from './image-uploader.tsx'
import { VariantsManager } from './variants-manager.tsx'

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
    .select({
      id: productVariants.id,
      title: productVariants.title,
      option1: productVariants.option1,
      option2: productVariants.option2,
      option3: productVariants.option3,
      price: productVariants.price,
      sku: productVariants.sku,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(asc(productVariants.position))

  const options = await db
    .select({
      name: productOptions.name,
      values: productOptions.values,
      position: productOptions.position,
    })
    .from(productOptions)
    .where(eq(productOptions.productId, product.id))
    .orderBy(asc(productOptions.position))

  const stocks = await db
    .select({
      variantId: inventoryItems.variantId,
      total: sum(inventoryItems.available).mapWith(Number),
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.shopId, shop.id))
    .groupBy(inventoryItems.variantId)
  const stockByVariant = new Map(stocks.map((s) => [s.variantId, s.total]))

  const variant = variants[0]

  const images = await db
    .select({
      id: productImages.id,
      r2KeyOrig: productImages.r2KeyOrig,
      alt: productImages.alt,
      bytes: productImages.bytes,
    })
    .from(productImages)
    .where(and(eq(productImages.productId, product.id), isNull(productImages.deletedAt)))
    .orderBy(asc(productImages.position), asc(productImages.createdAt))

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/${shopSlug}/products`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไปรายการสินค้า
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>รูปภาพ</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUploader
            shopSlug={shopSlug}
            productId={product.id}
            images={images.map((img) => ({
              id: img.id,
              publicUrl: publicImageUrl(img.r2KeyOrig),
              alt: img.alt,
              bytes: img.bytes,
            }))}
          />
        </CardContent>
      </Card>

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
              tags: product.tags ?? [],
            }}
            price={variant?.price ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ตัวเลือก + Variants</CardTitle>
        </CardHeader>
        <CardContent>
          <VariantsManager
            shopSlug={shopSlug}
            productId={product.id}
            options={options.map((o) => ({ name: o.name, values: o.values }))}
            variants={variants.map((v) => ({
              ...v,
              stock: stockByVariant.has(v.id) ? stockByVariant.get(v.id) ?? 0 : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
