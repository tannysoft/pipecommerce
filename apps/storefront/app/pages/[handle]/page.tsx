import { and, eq, isNull, lte, or } from '@pipecommerce/db'
import { pages } from '@pipecommerce/db/schema'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { sanitizeHtml } from '@/lib/html-sanitize.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

async function loadPage(shopId: string, handle: string) {
  const [row] = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.shopId, shopId),
        eq(pages.handle, handle),
        eq(pages.status, 'active'),
        isNull(pages.deletedAt),
        // ถ้า publishedAt ตั้งค่า → ต้อง <= now (กัน schedule future ในอนาคต)
        or(isNull(pages.publishedAt), lte(pages.publishedAt, new Date())),
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
    const page = await loadPage(shop.id, handle)
    if (!page) return {}
    return {
      title: page.seoTitle ?? page.title,
      description: page.seoDescription ?? undefined,
    }
  } catch {
    return {}
  }
}

export default async function StaticPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const shop = await requireShopFromHost()
  const page = await loadPage(shop.id, handle)
  if (!page) notFound()

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← {shop.name}
      </Link>

      <article className="space-y-4">
        {page.featuredImageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={page.featuredImageUrl}
            alt={page.title}
            className="aspect-video w-full rounded-xl border object-cover"
          />
        ) : null}
        <h1 className="text-3xl font-bold">{page.title}</h1>
        {page.body ? (
          // body = HTML จาก Tiptap editor — sanitize defense-in-depth
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }}
          />
        ) : (
          <p className="text-muted-foreground">หน้านี้ยังไม่มีเนื้อหา</p>
        )}
      </article>
    </main>
  )
}
