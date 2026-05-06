import { and, eq, isNull } from '@pipecommerce/db'
import { articleImages, articles } from '@pipecommerce/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { publicImageUrl } from '@/lib/r2.ts'
import { requireShop } from '@/lib/shop.ts'
import { ArticleEditForm } from './edit-form.tsx'
import { FeaturedImageUploader } from './featured-image-uploader.tsx'

export default async function ArticleEditorPage({
  params,
}: {
  params: Promise<{ shopSlug: string; articleId: string }>
}) {
  const { shopSlug, articleId } = await params
  const { shop } = await requireShop(shopSlug)

  const [article] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.shopId, shop.id), isNull(articles.deletedAt)))
    .limit(1)

  if (!article) notFound()

  let featuredUrl: string | null = null
  if (article.featuredImageId) {
    const [img] = await db
      .select({ r2KeyOrig: articleImages.r2KeyOrig })
      .from(articleImages)
      .where(and(eq(articleImages.id, article.featuredImageId), isNull(articleImages.deletedAt)))
      .limit(1)
    if (img) featuredUrl = publicImageUrl(img.r2KeyOrig)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/${shopSlug}/articles`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← กลับไปรายการ
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Featured image</CardTitle>
        </CardHeader>
        <CardContent>
          <FeaturedImageUploader
            shopSlug={shopSlug}
            articleId={article.id}
            currentUrl={featuredUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>แก้ไขบทความ</CardTitle>
        </CardHeader>
        <CardContent>
          <ArticleEditForm
            shopSlug={shopSlug}
            article={{
              id: article.id,
              title: article.title,
              handle: article.handle,
              body: article.body,
              excerpt: article.excerpt,
              authorName: article.authorName,
              status: article.status,
              tags: article.tags ?? [],
              seoTitle: article.seoTitle,
              seoDescription: article.seoDescription,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
