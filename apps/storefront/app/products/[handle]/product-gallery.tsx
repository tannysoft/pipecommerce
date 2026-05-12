'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export type ProductGalleryImage = {
  id: string
  url: string
  alt: string | null
}

/**
 * WooCommerce-style product gallery
 *
 * - Main image: large, aspect-square, click → fullscreen lightbox
 * - Thumbnail strip: scrollable on mobile, all images visible
 * - Click thumbnail → swaps main image + highlights active
 * - Keyboard: ←/→ to navigate, Esc closes lightbox
 */
export function ProductGallery({
  images,
  title,
}: {
  images: ProductGalleryImage[]
  title: string
}) {
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(false)
  const thumbsRef = useRef<HTMLDivElement>(null)

  const prev = useCallback(
    () => setActive((i) => (i - 1 + images.length) % images.length),
    [images.length],
  )
  const next = useCallback(
    () => setActive((i) => (i + 1) % images.length),
    [images.length],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (zoom && e.key === 'Escape') setZoom(false)
      if (images.length > 1) {
        if (e.key === 'ArrowLeft') prev()
        if (e.key === 'ArrowRight') next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom, prev, next, images.length])

  // Scroll active thumb into view
  useEffect(() => {
    const wrap = thumbsRef.current
    if (!wrap) return
    const el = wrap.querySelector<HTMLButtonElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [active])

  if (images.length === 0) {
    return <div className="aspect-square rounded-xl border bg-muted" />
  }

  const current = images[active]!

  return (
    <>
      <div className="space-y-3">
        <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.alt ?? title}
            onClick={() => setZoom(true)}
            className="size-full cursor-zoom-in object-cover transition hover:scale-105"
          />

          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="รูปก่อนหน้า"
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 shadow backdrop-blur transition hover:bg-background"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="รูปถัดไป"
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 shadow backdrop-blur transition hover:bg-background"
              >
                <ChevronRight className="size-5" />
              </button>
              <div className="absolute bottom-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium tabular-nums">
                {active + 1} / {images.length}
              </div>
            </>
          ) : null}
        </div>

        {images.length > 1 ? (
          <div
            ref={thumbsRef}
            className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                data-idx={idx}
                onClick={() => setActive(idx)}
                aria-label={`รูปที่ ${idx + 1}`}
                aria-current={idx === active ? 'true' : undefined}
                className={
                  'shrink-0 overflow-hidden rounded-md border-2 transition ' +
                  (idx === active
                    ? 'border-primary'
                    : 'border-transparent opacity-70 hover:opacity-100')
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  className="size-16 object-cover sm:size-20"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {zoom ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.alt ?? title}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      ) : null}
    </>
  )
}
