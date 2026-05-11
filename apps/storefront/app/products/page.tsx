import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  max,
  min,
  sql,
} from '@pipecommerce/db'
import {
  productImages,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { publicImageUrl } from '@/lib/image.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

const SORT_OPTIONS = [
  { key: 'newest', label: 'มาใหม่' },
  { key: 'price_asc', label: 'ราคา: ถูก → แพง' },
  { key: 'price_desc', label: 'ราคา: แพง → ถูก' },
  { key: 'title', label: 'ชื่อ A-Z' },
] as const
type SortKey = (typeof SORT_OPTIONS)[number]['key']

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string
    tag?: string | string[]
    min?: string
    max?: string
    q?: string
  }>
}) {
  const shop = await requireShopFromHost()
  const params = await searchParams
  const sort: SortKey =
    (SORT_OPTIONS.find((o) => o.key === params.sort)?.key ?? 'newest') as SortKey
  const selectedTags = (Array.isArray(params.tag) ? params.tag : params.tag ? [params.tag] : [])
    .map((t) => t.toLowerCase())
    .filter(Boolean)
  const minPrice = params.min ? Number(params.min) : null
  const maxPrice = params.max ? Number(params.max) : null
  const q = (params.q ?? '').trim()

  // Stage 1: load all candidate products (with min variant price) — apply text + tag + price filter
  const baseFilter = and(
    eq(products.shopId, shop.id),
    eq(products.status, 'active'),
    isNull(products.deletedAt),
  )

  const candidateConditions = [baseFilter]
  if (q) {
    candidateConditions.push(sql`${products.title} ilike ${'%' + q + '%'}`)
  }
  if (selectedTags.length > 0) {
    candidateConditions.push(sql`${products.tags} && ${selectedTags}::text[]`)
  }

  const candidates = await db
    .select({
      id: products.id,
      title: products.title,
      handle: products.handle,
      tags: products.tags,
      publishedAt: products.publishedAt,
      fromPrice: min(productVariants.price),
    })
    .from(products)
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(and(...candidateConditions))
    .groupBy(products.id)
    .limit(200)

  // Apply price filter post-hoc (because price is aggregated)
  let filtered = candidates.filter((p) => {
    const price = p.fromPrice !== null ? Number(p.fromPrice) : null
    if (price === null) return false
    if (minPrice !== null && price < minPrice) return false
    if (maxPrice !== null && price > maxPrice) return false
    return true
  })

  // Sort
  filtered.sort((a, b) => {
    if (sort === 'price_asc') return Number(a.fromPrice) - Number(b.fromPrice)
    if (sort === 'price_desc') return Number(b.fromPrice) - Number(a.fromPrice)
    if (sort === 'title') return a.title.localeCompare(b.title)
    // newest
    return (
      (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
    )
  })
  filtered = filtered.slice(0, 60)
  const ids = filtered.map((p) => p.id)

  // Available tag facets (from full candidate set, not filtered) — for sidebar
  const tagCounts = new Map<string, number>()
  for (const p of candidates) {
    for (const t of p.tags ?? []) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    }
  }
  const tagFacets = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)

  // Price range bounds (across active products)
  const [bounds] = await db
    .select({
      lo: min(productVariants.price),
      hi: max(productVariants.price),
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(baseFilter)

  // Load images for the visible products
  const imageRows = ids.length
    ? await db
        .select({
          productId: productImages.productId,
          r2KeyOrig: productImages.r2KeyOrig,
          position: productImages.position,
        })
        .from(productImages)
        .where(
          and(inArray(productImages.productId, ids), isNull(productImages.deletedAt)),
        )
        .orderBy(asc(productImages.productId), asc(productImages.position))
    : []

  const firstImageByProduct = new Map<string, string>()
  for (const img of imageRows) {
    if (!firstImageByProduct.has(img.productId)) {
      firstImageByProduct.set(img.productId, img.r2KeyOrig)
    }
  }

  function buildHref(overrides: Record<string, string | string[] | null>): string {
    const sp = new URLSearchParams()
    if (sort !== 'newest') sp.set('sort', sort)
    if (q) sp.set('q', q)
    for (const t of selectedTags) sp.append('tag', t)
    if (minPrice !== null) sp.set('min', String(minPrice))
    if (maxPrice !== null) sp.set('max', String(maxPrice))
    for (const [k, v] of Object.entries(overrides)) {
      sp.delete(k)
      if (v === null) continue
      if (Array.isArray(v)) for (const item of v) sp.append(k, item)
      else sp.set(k, v)
    }
    const qs = sp.toString()
    return qs ? `/products?${qs}` : '/products'
  }

  function toggleTagHref(tag: string): string {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag]
    return buildHref({ tag: next.length === 0 ? null : next })
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← {shop.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">สินค้าทั้งหมด</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} รายการ</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-6">
          <form className="space-y-2">
            <label className="text-sm font-medium">ค้นหา</label>
            {sort !== 'newest' ? <input type="hidden" name="sort" value={sort} /> : null}
            {selectedTags.map((t) => (
              <input key={t} type="hidden" name="tag" value={t} />
            ))}
            {minPrice !== null ? <input type="hidden" name="min" value={String(minPrice)} /> : null}
            {maxPrice !== null ? <input type="hidden" name="max" value={String(maxPrice)} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="ชื่อสินค้า"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-md border px-3 py-1 text-xs hover:bg-muted"
            >
              ค้นหา
            </button>
          </form>

          {tagFacets.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">Tags</h3>
              <ul className="space-y-1 text-sm">
                {tagFacets.map(([tag, n]) => {
                  const active = selectedTags.includes(tag)
                  return (
                    <li key={tag}>
                      <Link
                        href={toggleTagHref(tag)}
                        className={`flex items-center justify-between rounded px-2 py-1 ${
                          active ? 'bg-foreground text-background' : 'hover:bg-muted'
                        }`}
                      >
                        <span>#{tag}</span>
                        <span className="text-xs opacity-70">{n}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          <form className="space-y-2">
            <h3 className="text-sm font-medium">ราคา (บาท)</h3>
            {sort !== 'newest' ? <input type="hidden" name="sort" value={sort} /> : null}
            {q ? <input type="hidden" name="q" value={q} /> : null}
            {selectedTags.map((t) => (
              <input key={t} type="hidden" name="tag" value={t} />
            ))}
            <div className="flex items-center gap-1.5 text-sm">
              <input
                type="number"
                name="min"
                defaultValue={minPrice ?? ''}
                placeholder={bounds?.lo ?? '0'}
                min="0"
                className="w-full rounded-md border bg-background px-2 py-1"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="number"
                name="max"
                defaultValue={maxPrice ?? ''}
                placeholder={bounds?.hi ?? ''}
                min="0"
                className="w-full rounded-md border bg-background px-2 py-1"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md border px-3 py-1 text-xs hover:bg-muted"
            >
              กรอง
            </button>
          </form>

          {selectedTags.length > 0 || minPrice !== null || maxPrice !== null || q ? (
            <Link
              href="/products"
              className="block text-center text-xs text-muted-foreground hover:underline"
            >
              ล้าง filter ทั้งหมด
            </Link>
          ) : null}
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <p className="text-sm text-muted-foreground">
              {filtered.length} รายการ
              {selectedTags.length > 0 ? ` · กรองด้วย ${selectedTags.length} tag` : ''}
            </p>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">เรียง:</span>
              {SORT_OPTIONS.map((o) => (
                <Link
                  key={o.key}
                  href={buildHref({ sort: o.key === 'newest' ? null : o.key })}
                  className={`rounded px-2 py-0.5 ${
                    sort === o.key ? 'bg-foreground text-background' : 'hover:bg-muted'
                  }`}
                >
                  {o.label}
                </Link>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              ไม่พบสินค้าที่ตรงเงื่อนไข
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {filtered.map((p) => {
                const r2Key = firstImageByProduct.get(p.id)
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
                    <h2 className="mt-3 line-clamp-2 text-sm font-medium group-hover:text-primary">
                      {p.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      ฿{p.fromPrice ?? '—'}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
