'use client'

import type { Section } from '../sections.ts'

/**
 * Client-side visual preview ของ section
 * ไม่ fetch DB — ใช้ placeholder สำหรับ products/collections
 * เน้น layout + content ของ section ให้ใกล้เคียง storefront จริง
 */
export function SectionPreview({ section }: { section: Section }) {
  switch (section.type) {
    case 'hero':
      return <HeroPreview section={section} />
    case 'featuredProducts':
      return <FeaturedProductsPreview section={section} />
    case 'featuredCollections':
      return <FeaturedCollectionsPreview section={section} />
    case 'textBlock':
      return <TextBlockPreview section={section} />
    case 'imageBanner':
      return <ImageBannerPreview section={section} />
  }
}

function HeroPreview({ section }: { section: Extract<Section, { type: 'hero' }> }) {
  const s = section.settings
  const align = s.align === 'left' ? 'text-left items-start' : 'text-center items-center'
  return (
    <div
      className={`flex min-h-[180px] flex-col justify-center px-6 py-10 ${align}`}
      style={{
        backgroundColor: s.backgroundColor ?? '#fafafa',
        color: s.textColor ?? '#111',
        backgroundImage: s.imageUrl ? `url(${s.imageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="mx-auto max-w-2xl space-y-2">
        {s.headline ? (
          <h1 className="text-2xl font-bold">{s.headline}</h1>
        ) : (
          <p className="text-sm italic opacity-50">(no headline)</p>
        )}
        {s.subheadline ? <p className="text-sm opacity-90">{s.subheadline}</p> : null}
        {s.ctaText ? (
          <div className="pt-1">
            <span className="inline-block rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background">
              {s.ctaText}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function FeaturedProductsPreview({
  section,
}: {
  section: Extract<Section, { type: 'featuredProducts' }>
}) {
  const s = section.settings
  const count = Math.min(8, s.productHandles?.length || s.limit || 4)
  return (
    <div className="bg-card px-6 py-6">
      {s.headline ? (
        <h2 className="mb-3 text-lg font-bold">{s.headline}</h2>
      ) : null}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded border bg-background p-2">
            <div className="aspect-square rounded bg-muted" />
            <div className="mt-2 h-2 w-3/4 rounded bg-muted" />
            <div className="mt-1 h-2 w-1/3 rounded bg-muted" />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {s.productHandles?.length
          ? `${s.productHandles.length} handle ที่เลือก`
          : `${s.limit ?? 8} สินค้าล่าสุด (auto)`}
      </p>
    </div>
  )
}

function FeaturedCollectionsPreview({
  section,
}: {
  section: Extract<Section, { type: 'featuredCollections' }>
}) {
  const s = section.settings
  const count = Math.max(1, Math.min(3, s.collectionHandles?.length || 3))
  return (
    <div className="bg-card px-6 py-6">
      {s.headline ? <h2 className="mb-3 text-lg font-bold">{s.headline}</h2> : null}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded border bg-background px-3 py-6 text-center"
          >
            <div className="mx-auto h-3 w-2/3 rounded bg-muted" />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {s.collectionHandles?.length
          ? `${s.collectionHandles.length} collection ที่เลือก`
          : 'ยังไม่ได้เลือก collection'}
      </p>
    </div>
  )
}

function TextBlockPreview({
  section,
}: {
  section: Extract<Section, { type: 'textBlock' }>
}) {
  const s = section.settings
  const align = s.align === 'left' ? 'text-left' : 'text-center'
  return (
    <div className={`bg-card px-6 py-8 ${align}`}>
      {s.headline ? <h2 className="mb-2 text-lg font-bold">{s.headline}</h2> : null}
      {s.body ? (
        <div
          className="prose prose-sm mx-auto max-w-none"
          dangerouslySetInnerHTML={{ __html: s.body }}
        />
      ) : (
        <p className="text-xs italic text-muted-foreground">(no body)</p>
      )}
    </div>
  )
}

function ImageBannerPreview({
  section,
}: {
  section: Extract<Section, { type: 'imageBanner' }>
}) {
  const s = section.settings
  if (!s.imageUrl) {
    return (
      <div className="flex h-32 items-center justify-center bg-muted text-xs text-muted-foreground">
        (ยังไม่มี image URL)
      </div>
    )
  }
  const heightClass =
    s.height === 'lg' ? 'h-48' : s.height === 'sm' ? 'h-20' : 'h-32'
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={s.imageUrl}
      alt={s.altText ?? ''}
      className={`w-full object-cover ${heightClass}`}
    />
  )
}
