import { and, eq, isNull, lte, or } from '@pipecommerce/db'
import { articleImages, articles } from '@pipecommerce/db/schema'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { sanitizeHtml } from '@/lib/html-sanitize.ts'
import { publicImageUrl } from '@/lib/image.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

async function loadArticle(shopId: string, handle: string) {
  const [row] = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.shopId, shopId),
        eq(articles.handle, handle),
        eq(articles.status, 'active'),
        isNull(articles.deletedAt),
        or(isNull(articles.publishedAt), lte(articles.publishedAt, new Date())),
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
    const article = await loadArticle(shop.id, handle)
    if (!article) return {}
    return {
      title: article.seoTitle ?? article.title,
      description: article.seoDescription ?? article.excerpt ?? undefined,
    }
  } catch {
    return {}
  }
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const shop = await requireShopFromHost()
  const article = await loadArticle(shop.id, handle)
  if (!article) notFound()

  // Prefer featuredImageUrl (new URL-based) → fallback featuredImageId (legacy article_images)
  let featuredUrl: string | null = article.featuredImageUrl ?? null
  if (!featuredUrl && article.featuredImageId) {
    const [img] = await db
      .select({ r2KeyOrig: articleImages.r2KeyOrig })
      .from(articleImages)
      .where(
        and(eq(articleImages.id, article.featuredImageId), isNull(articleImages.deletedAt)),
      )
      .limit(1)
    if (img) featuredUrl = publicImageUrl(img.r2KeyOrig)
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Link
        href="/blog"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← บทความ
      </Link>

      <article className="space-y-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold md:text-4xl">{article.title}</h1>
          <div className="flex gap-3 text-sm text-muted-foreground">
            {article.authorName ? <span>โดย {article.authorName}</span> : null}
            {article.publishedAt ? (
              <time dateTime={new Date(article.publishedAt).toISOString()}>
                {new Date(article.publishedAt).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
            ) : null}
          </div>
        </header>

        {featuredUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={featuredUrl}
            alt={article.title}
            className="aspect-video w-full rounded-xl object-cover"
          />
        ) : null}

        {article.body ? (
          // body = HTML จาก Tiptap editor — sanitize defense-in-depth
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.body) }}
          />
        ) : (
          <p className="text-muted-foreground">บทความนี้ยังไม่มีเนื้อหา</p>
        )}

        {article.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-t pt-4">
            {article.tags.map((t) => (
              <Link
                key={t}
                href={`/tags/${encodeURIComponent(t)}`}
                className="rounded-full border bg-secondary/50 px-2.5 py-0.5 text-xs hover:bg-secondary"
              >
                #{t}
              </Link>
            ))}
          </div>
        ) : null}
      </article>
    </main>
  )
}
