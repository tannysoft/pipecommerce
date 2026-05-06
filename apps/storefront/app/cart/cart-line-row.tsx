'use client'

import { Button } from '@pipecommerce/ui'
import Link from 'next/link'
import { useTransition } from 'react'
import { removeCartItem, updateCartItemQty } from './actions.ts'

const fmtBaht = (raw: string | number) =>
  Number(raw).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function CartLineRow({
  itemId,
  quantity,
  variantTitle,
  productTitle,
  productHandle,
  unitPrice,
  imageUrl,
}: {
  itemId: string
  quantity: number
  variantTitle: string
  productTitle: string
  productHandle: string
  unitPrice: string
  imageUrl: string | null
}) {
  const [pending, startTransition] = useTransition()

  function setQty(newQty: number) {
    startTransition(async () => {
      await updateCartItemQty(itemId, newQty)
    })
  }

  function remove() {
    startTransition(async () => {
      await removeCartItem(itemId)
    })
  }

  const subtotal = Number(unitPrice) * quantity

  return (
    <article className="flex gap-4 rounded-xl border bg-card p-3">
      {imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={imageUrl}
          alt={productTitle}
          className="h-24 w-24 rounded-lg border object-cover"
        />
      ) : (
        <div className="h-24 w-24 rounded-lg bg-muted" />
      )}

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <Link href={`/products/${productHandle}`} className="font-medium hover:text-primary">
            {productTitle}
          </Link>
          {variantTitle && variantTitle !== 'Default Title' ? (
            <p className="text-xs text-muted-foreground">{variantTitle}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">฿{fmtBaht(unitPrice)} / ชิ้น</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={pending || quantity <= 1}
              onClick={() => setQty(quantity - 1)}
            >
              −
            </Button>
            <span className="min-w-8 text-center text-sm tabular-nums">{quantity}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={pending}
              onClick={() => setQty(quantity + 1)}
            >
              +
            </Button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="ml-2 text-xs text-muted-foreground hover:text-destructive"
            >
              ลบ
            </button>
          </div>
          <p className="font-mono text-sm font-semibold">฿{fmtBaht(subtotal)}</p>
        </div>
      </div>
    </article>
  )
}
