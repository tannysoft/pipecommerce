import { and, asc, desc, eq, inArray, isNull, lte, or } from '@pipecommerce/db'
import { articleImages, articles } from '@pipecommerce/db/schema'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { publicImageUrl } from '@/lib/image.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

export default async function BlogIndexPage() {
  const shop = await requireShopFromHost()

  const list = await db
    .select({
      id: articles.id,
      title: articles.title,
      handle: articles.handle,
      excerpt: articles.excerpt,
      authorName: articles.authorName,
      publishedAt: articles.publishedAt,
      featuredImageId: articles.featuredImageId,
    })
    .from(articles)
    .where(
      and(
        eq(articles.shopId, shop.id),
        eq(articles.status, 'active'),
        isNull(articles.deletedAt),
        or(isNull(articles.publishedAt), lte(articles.publishedAt, new Date())),
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(30)

  const imageIds = list
    .map((a) => a.featuredImageId)
    .filter((id): id is string => Boolean(id))
  const imageMap = new Map<string, string>()
  if (imageIds.length) {
    const rows = await db
      .select({
        id: articleImages.id,
        r2KeyOrig: articleImages.r2KeyOrig,
      })
      .from(articleImages)
      .where(and(inArray(articleImages.id, imageIds), isNull(articleImages.deletedAt)))
      .orderBy(asc(articleImages.id))
    for (const r of rows) imageMap.set(r.id, r.r2KeyOrig)
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {shop.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">บทความ</h1>
        <p className="text-sm text-muted-foreground">{list.length} รายการ</p>
      </header>

      {list.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีบทความ</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {list.map((a) => {
            const r2Key = a.featuredImageId ? imageMap.get(a.featuredImageId) : null
            return (
              <Link
                key={a.id}
                href={`/blog/${a.handle}`}
                className="group space-y-3 rounded-xl border bg-card p-4 transition hover:shadow-md"
              >
                {r2Key ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={publicImageUrl(r2Key)}
                    alt={a.title}
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="aspect-video rounded-lg bg-muted" />
                )}
                <div>
                  <h2 className="text-lg font-semibold group-hover:text-primary">{a.title}</h2>
                  {a.excerpt ? (
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                      {a.excerpt}
                    </p>
                  ) : null}
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    {a.authorName ? <span>{a.authorName}</span> : null}
                    {a.publishedAt ? (
                      <time dateTime={new Date(a.publishedAt).toISOString()}>
                        {new Date(a.publishedAt).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                    ) : null}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
