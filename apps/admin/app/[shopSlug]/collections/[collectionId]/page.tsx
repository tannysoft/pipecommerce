import { and, asc, eq, isNull, notInArray } from '@pipecommerce/db'
import { collectionProducts, collections, products } from '@pipecommerce/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { CollectionEditForm } from './edit-form.tsx'
import { CollectionProductsManager } from './products-manager.tsx'

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; collectionId: string }>
}) {
  const { shopSlug, collectionId } = await params
  const { shop } = await requireShop(shopSlug)

  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.shopId, shop.id)))
    .limit(1)
  if (!collection) notFound()

  const inCollection = await db
    .select({
      id: products.id,
      title: products.title,
      handle: products.handle,
    })
    .from(collectionProducts)
    .innerJoin(products, eq(collectionProducts.productId, products.id))
    .where(eq(collectionProducts.collectionId, collectionId))
    .orderBy(asc(collectionProducts.position))

  const inCollectionIds = inCollection.map((p) => p.id)
  const available = await db
    .select({
      id: products.id,
      title: products.title,
      handle: products.handle,
    })
    .from(products)
    .where(
      and(
        eq(products.shopId, shop.id),
        isNull(products.deletedAt),
        inCollectionIds.length > 0 ? notInArray(products.id, inCollectionIds) : undefined,
      ),
    )
    .orderBy(asc(products.title))
    .limit(200)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/${shopSlug}/collections`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไปรายการ
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>แก้ไข Collection</CardTitle>
        </CardHeader>
        <CardContent>
          <CollectionEditForm
            shopSlug={shopSlug}
            collection={{
              id: collection.id,
              title: collection.title,
              handle: collection.handle,
              description: collection.description,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>สินค้าใน Collection</CardTitle>
        </CardHeader>
        <CardContent>
          <CollectionProductsManager
            shopSlug={shopSlug}
            collectionId={collection.id}
            inCollection={inCollection}
            available={available}
          />
        </CardContent>
      </Card>
    </div>
  )
}
