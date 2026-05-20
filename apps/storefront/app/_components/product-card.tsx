import Link from 'next/link'
import { publicImageUrl } from '@/lib/image.ts'

export type ProductCardData = {
  handle: string
  title: string
  price: string | number
  currency: string
  imageR2Key: string | null
}

const fmt = (raw: string | number) =>
  Number(raw).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

/**
 * Reusable product card — shared between featured products, related,
 * recently viewed, search results
 */
export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link
      href={`/products/${product.handle}`}
      className="group block overflow-hidden rounded-lg border transition hover:shadow-md"
    >
      <div className="aspect-square overflow-hidden bg-muted">
        {product.imageR2Key ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicImageUrl(product.imageR2Key)}
            alt={product.title}
            loading="lazy"
            className="size-full object-cover transition group-hover:scale-105"
          />
        ) : null}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-medium">{product.title}</p>
        <p className="mt-1 text-sm tabular-nums">
          {product.currency} {fmt(product.price)}
        </p>
      </div>
    </Link>
  )
}
