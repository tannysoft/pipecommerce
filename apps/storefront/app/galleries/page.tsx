import { and, asc, desc, eq, inArray, isNull, lte, or } from '@pipecommerce/db'
import { galleries, galleryImages } from '@pipecommerce/db/schema'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { publicImageUrl } from '@/lib/image.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

export default async function GalleriesIndexPage() {
  const shop = await requireShopFromHost()

  const list = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      handle: galleries.handle,
      description: galleries.description,
    })
    .from(galleries)
    .where(
      and(
        eq(galleries.shopId, shop.id),
        eq(galleries.status, 'active'),
        isNull(galleries.deletedAt),
        or(isNull(galleries.publishedAt), lte(galleries.publishedAt, new Date())),
      ),
    )
    .orderBy(desc(galleries.publishedAt))
    .limit(30)

  // first image per gallery (cover)
  const ids = list.map((g) => g.id)
  const imageRows = ids.length
    ? await db
        .select({
          galleryId: galleryImages.galleryId,
          r2KeyOrig: galleryImages.r2KeyOrig,
          position: galleryImages.position,
        })
        .from(galleryImages)
        .where(
          and(inArray(galleryImages.galleryId, ids), isNull(galleryImages.deletedAt)),
        )
        .orderBy(asc(galleryImages.galleryId), asc(galleryImages.position))
    : []
  const cover = new Map<string, string>()
  for (const r of imageRows) {
    if (!cover.has(r.galleryId)) cover.set(r.galleryId, r.r2KeyOrig)
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← {shop.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Galleries</h1>
      </header>

      {list.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มี gallery</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => {
            const r2Key = cover.get(g.id)
            return (
              <Link
                key={g.id}
                href={`/galleries/${g.handle}`}
                className="group space-y-2 rounded-xl border bg-card p-3 transition hover:shadow-md"
              >
                {r2Key ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={publicImageUrl(r2Key)}
                    alt={g.title}
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="aspect-[4/3] rounded-lg bg-muted" />
                )}
                <div>
                  <h2 className="font-medium group-hover:text-primary">{g.title}</h2>
                  {g.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{g.description}</p>
                  ) : null}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
