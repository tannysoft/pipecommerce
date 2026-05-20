import { and, eq, inArray, isNull } from '@pipecommerce/db'
import {
  collections,
  productImages,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { sanitizeHtml } from '@/lib/html-sanitize.ts'
import { publicImageUrl } from '@/lib/image.ts'
import type { Section } from '@/lib/sections.ts'

const fmtBaht = (raw: string | number) =>
  Number(raw).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

export async function SectionRenderer({
  shopId,
  section,
}: {
  shopId: string
  section: Section
}) {
  switch (section.type) {
    case 'hero':
      return <HeroBlock section={section} />
    case 'featuredProducts':
      return <FeaturedProductsBlock shopId={shopId} section={section} />
    case 'featuredCollections':
      return <FeaturedCollectionsBlock shopId={shopId} section={section} />
    case 'textBlock':
      return <TextBlockBlock section={section} />
    case 'imageBanner':
      return <ImageBannerBlock section={section} />
    case 'faq':
      return <FaqBlock section={section} />
    case 'testimonials':
      return <TestimonialsBlock section={section} />
    case 'imageGrid':
      return <ImageGridBlock section={section} />
    case 'newsletter':
      return <NewsletterBlock section={section} />
  }
}

function FaqBlock({ section }: { section: Extract<Section, { type: 'faq' }> }) {
  const s = section.settings
  const items = s.items ?? []
  if (items.length === 0) return null
  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      {s.headline ? (
        <h2 className="mb-6 text-center text-2xl font-bold md:text-3xl">{s.headline}</h2>
      ) : null}
      <div className="space-y-3">
        {items.map((item, i) => (
          <details key={i} className="group rounded-lg border bg-background p-4">
            <summary className="cursor-pointer list-none font-medium marker:hidden">
              <span className="flex items-center justify-between gap-2">
                <span>{item.question}</span>
                <span className="text-muted-foreground transition group-open:rotate-180">
                  ⌄
                </span>
              </span>
            </summary>
            <div className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

function TestimonialsBlock({
  section,
}: {
  section: Extract<Section, { type: 'testimonials' }>
}) {
  const s = section.settings
  const items = s.items ?? []
  if (items.length === 0) return null
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      {s.headline ? (
        <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">{s.headline}</h2>
      ) : null}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <p className="italic text-muted-foreground">&ldquo;{item.quote}&rdquo;</p>
            <div className="mt-4 flex items-center gap-3">
              {item.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.avatarUrl}
                  alt={item.name}
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {item.name[0]?.toUpperCase() ?? '?'}
                </span>
              )}
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                {item.role ? (
                  <p className="text-xs text-muted-foreground">{item.role}</p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ImageGridBlock({
  section,
}: {
  section: Extract<Section, { type: 'imageGrid' }>
}) {
  const s = section.settings
  const items = s.items ?? []
  const cols = s.columns ?? 3
  if (items.length === 0) return null
  const gridClass =
    cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 md:grid-cols-4' : 'sm:grid-cols-3'
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      {s.headline ? (
        <h2 className="mb-6 text-center text-2xl font-bold md:text-3xl">{s.headline}</h2>
      ) : null}
      <div className={`grid grid-cols-1 gap-4 ${gridClass}`}>
        {items.map((item, i) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.alt ?? ''}
              loading="lazy"
              className="aspect-square w-full rounded-lg object-cover transition hover:scale-[1.02]"
            />
          )
          return item.link ? (
            <Link key={i} href={item.link} className="block">
              {img}
            </Link>
          ) : (
            <div key={i}>{img}</div>
          )
        })}
      </div>
    </section>
  )
}

function NewsletterBlock({
  section,
}: {
  section: Extract<Section, { type: 'newsletter' }>
}) {
  const s = section.settings
  return (
    <section className="mx-auto max-w-2xl px-6 py-16 text-center">
      {s.headline ? (
        <h2 className="text-2xl font-bold md:text-3xl">{s.headline}</h2>
      ) : null}
      {s.subheadline ? (
        <p className="mt-2 text-muted-foreground">{s.subheadline}</p>
      ) : null}
      <form
        action="/api/newsletter/subscribe"
        method="post"
        className="mx-auto mt-6 flex max-w-md gap-2"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="your@email.com"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          {s.buttonText ?? 'สมัคร'}
        </button>
      </form>
    </section>
  )
}

function HeroBlock({ section }: { section: Extract<Section, { type: 'hero' }> }) {
  const s = section.settings
  const align = s.align === 'left' ? 'text-left items-start' : 'text-center items-center'
  return (
    <section
      className={`relative flex min-h-[360px] flex-col justify-center px-6 py-16 md:py-24 ${align}`}
      style={{
        backgroundColor: s.backgroundColor ?? undefined,
        color: s.textColor ?? undefined,
        backgroundImage: s.imageUrl ? `url(${s.imageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        {s.headline ? (
          <h1 className="text-3xl font-bold md:text-5xl">{s.headline}</h1>
        ) : null}
        {s.subheadline ? (
          <p className="text-base opacity-90 md:text-lg">{s.subheadline}</p>
        ) : null}
        {s.ctaText && s.ctaUrl ? (
          <div className="pt-2">
            <Link
              href={s.ctaUrl}
              className="inline-flex items-center rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
            >
              {s.ctaText}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}

async function FeaturedProductsBlock({
  shopId,
  section,
}: {
  shopId: string
  section: Extract<Section, { type: 'featuredProducts' }>
}) {
  const s = section.settings
  const handles = (s.productHandles ?? []).filter(Boolean)
  const limit = Math.max(1, Math.min(24, s.limit ?? 8))

  const baseFilter = and(
    eq(products.shopId, shopId),
    eq(products.status, 'active'),
    isNull(products.deletedAt),
  )

  const productList =
    handles.length > 0
      ? await db
          .select({ id: products.id, title: products.title, handle: products.handle })
          .from(products)
          .where(and(baseFilter, inArray(products.handle, handles)))
          .limit(handles.length)
      : await db
          .select({ id: products.id, title: products.title, handle: products.handle })
          .from(products)
          .where(baseFilter)
          .limit(limit)

  const ids = productList.map((p) => p.id)
  if (ids.length === 0) return null

  const [variants, images] = await Promise.all([
    db
      .select({ productId: productVariants.productId, price: productVariants.price })
      .from(productVariants)
      .where(inArray(productVariants.productId, ids)),
    db
      .select({
        productId: productImages.productId,
        r2KeyOrig: productImages.r2KeyOrig,
        position: productImages.position,
      })
      .from(productImages)
      .where(
        and(inArray(productImages.productId, ids), isNull(productImages.deletedAt)),
      ),
  ])

  const priceMap = new Map<string, string>()
  for (const v of variants) {
    if (
      !priceMap.has(v.productId) ||
      Number(priceMap.get(v.productId)) > Number(v.price)
    ) {
      priceMap.set(v.productId, v.price)
    }
  }
  const imageMap = new Map<string, string>()
  for (const img of images) {
    if (!imageMap.has(img.productId)) imageMap.set(img.productId, img.r2KeyOrig)
  }

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {s.headline ? (
          <h2 className="mb-6 text-2xl font-bold md:text-3xl">{s.headline}</h2>
        ) : null}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {productList.map((p) => {
            const r2Key = imageMap.get(p.id)
            return (
              <Link
                key={p.id}
                href={`/products/${p.handle}`}
                className="group rounded-xl border bg-card p-3 transition hover:shadow-md"
              >
                {r2Key ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={publicImageUrl(r2Key)}
                    alt={p.title}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="aspect-square rounded-lg bg-muted" />
                )}
                <h3 className="mt-3 line-clamp-2 text-sm font-medium group-hover:text-primary">
                  {p.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  ฿{priceMap.has(p.id) ? fmtBaht(priceMap.get(p.id)!) : '—'}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

async function FeaturedCollectionsBlock({
  shopId,
  section,
}: {
  shopId: string
  section: Extract<Section, { type: 'featuredCollections' }>
}) {
  const s = section.settings
  const handles = (s.collectionHandles ?? []).filter(Boolean)
  if (handles.length === 0) return null

  const list = await db
    .select({
      id: collections.id,
      title: collections.title,
      handle: collections.handle,
    })
    .from(collections)
    .where(and(eq(collections.shopId, shopId), inArray(collections.handle, handles)))

  if (list.length === 0) return null

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {s.headline ? (
          <h2 className="mb-6 text-2xl font-bold md:text-3xl">{s.headline}</h2>
        ) : null}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.handle}`}
              className="group rounded-xl border bg-card p-6 text-center transition hover:shadow-md"
            >
              <h3 className="text-lg font-semibold group-hover:text-primary">
                {c.title}
              </h3>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function TextBlockBlock({
  section,
}: {
  section: Extract<Section, { type: 'textBlock' }>
}) {
  const s = section.settings
  const align = s.align === 'left' ? 'text-left' : 'text-center'
  return (
    <section className={`px-6 py-12 ${align}`}>
      <div className="mx-auto max-w-3xl space-y-4">
        {s.headline ? (
          <h2 className="text-2xl font-bold md:text-3xl">{s.headline}</h2>
        ) : null}
        {s.body ? (
          <div
            className="prose mx-auto max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.body) }}
          />
        ) : null}
      </div>
    </section>
  )
}

function ImageBannerBlock({
  section,
}: {
  section: Extract<Section, { type: 'imageBanner' }>
}) {
  const s = section.settings
  if (!s.imageUrl) return null
  const heightClass =
    s.height === 'lg' ? 'h-[480px]' : s.height === 'sm' ? 'h-[200px]' : 'h-[320px]'
  const inner = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={s.imageUrl}
      alt={s.altText ?? ''}
      className={`w-full object-cover ${heightClass}`}
    />
  )
  if (s.link) {
    return (
      <Link href={s.link} className="block">
        {inner}
      </Link>
    )
  }
  return <section>{inner}</section>
}
