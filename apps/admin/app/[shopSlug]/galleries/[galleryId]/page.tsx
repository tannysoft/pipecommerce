import { and, asc, eq, isNull } from '@pipecommerce/db'
import { galleries, galleryImages } from '@pipecommerce/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { publicImageUrl } from '@/lib/r2.ts'
import { requireShop } from '@/lib/shop.ts'
import { GalleryEditForm } from './edit-form.tsx'
import { GalleryImagesManager } from './images-manager.tsx'

export default async function GalleryEditorPage({
  params,
}: {
  params: Promise<{ shopSlug: string; galleryId: string }>
}) {
  const { shopSlug, galleryId } = await params
  const { shop } = await requireShop(shopSlug)

  const [gallery] = await db
    .select()
    .from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.shopId, shop.id), isNull(galleries.deletedAt)))
    .limit(1)
  if (!gallery) notFound()

  const images = await db
    .select({
      id: galleryImages.id,
      r2KeyOrig: galleryImages.r2KeyOrig,
      alt: galleryImages.alt,
      caption: galleryImages.caption,
    })
    .from(galleryImages)
    .where(and(eq(galleryImages.galleryId, gallery.id), isNull(galleryImages.deletedAt)))
    .orderBy(asc(galleryImages.position), asc(galleryImages.createdAt))

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/${shopSlug}/galleries`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไปรายการ
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>รูปภาพ ({images.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <GalleryImagesManager
            shopSlug={shopSlug}
            galleryId={gallery.id}
            images={images.map((img) => ({
              id: img.id,
              publicUrl: publicImageUrl(img.r2KeyOrig),
              alt: img.alt,
              caption: img.caption,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>แก้ไข Gallery</CardTitle>
        </CardHeader>
        <CardContent>
          <GalleryEditForm
            shopSlug={shopSlug}
            gallery={{
              id: gallery.id,
              title: gallery.title,
              handle: gallery.handle,
              description: gallery.description,
              status: gallery.status,
              seoTitle: gallery.seoTitle,
              seoDescription: gallery.seoDescription,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
