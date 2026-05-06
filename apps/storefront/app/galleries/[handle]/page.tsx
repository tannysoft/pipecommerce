import { and, asc, eq, isNull, lte, or } from '@pipecommerce/db'
import { galleries, galleryImages } from '@pipecommerce/db/schema'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { publicImageUrl } from '@/lib/image.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

async function loadGallery(shopId: string, handle: string) {
  const [row] = await db
    .select()
    .from(galleries)
    .where(
      and(
        eq(galleries.shopId, shopId),
        eq(galleries.handle, handle),
        eq(galleries.status, 'active'),
        isNull(galleries.deletedAt),
        or(isNull(galleries.publishedAt), lte(galleries.publishedAt, new Date())),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  try {
    const shop = await requireShopFromHost()
    const gallery = await loadGallery(shop.id, handle)
    if (!gallery) return {}
    return {
      title: gallery.seoTitle ?? gallery.title,
      description: gallery.seoDescription ?? gallery.description ?? undefined,
    }
  } catch {
    return {}
  }
}

export default async function GalleryDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const shop = await requireShopFromHost()
  const gallery = await loadGallery(shop.id, handle)
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
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <Link
        href="/galleries"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Galleries
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{gallery.title}</h1>
        {gallery.description ? (
          <p className="text-muted-foreground">{gallery.description}</p>
        ) : null}
      </header>

      {images.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีรูปใน gallery นี้</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {images.map((img) => (
            <figure key={img.id} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicImageUrl(img.r2KeyOrig)}
                alt={img.alt ?? gallery.title}
                className="w-full rounded-lg border object-cover"
              />
              {img.caption ? (
                <figcaption className="text-xs text-muted-foreground">{img.caption}</figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      )}
    </main>
  )
}
