'use client'

import { useMemo, useState } from 'react'
import { AddToCartButton } from './add-to-cart-button.tsx'

type Option = { name: string; values: string[] }
type Variant = {
  id: string
  title: string
  option1: string | null
  option2: string | null
  option3: string | null
  price: string
  stock: number | null // null = untracked, number = available
}

type Props = {
  options: Option[]
  variants: Variant[]
}

const fmtBaht = (raw: string | number) =>
  Number(raw).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function VariantSelector({ options, variants }: Props) {
  const initial = variants[0]
  const [selected, setSelected] = useState<(string | null)[]>(() => [
    initial?.option1 ?? null,
    initial?.option2 ?? null,
    initial?.option3 ?? null,
  ])

  const matched = useMemo(() => {
    return (
      variants.find(
        (v) =>
          v.option1 === selected[0] &&
          v.option2 === selected[1] &&
          v.option3 === selected[2],
      ) ?? null
    )
  }, [selected, variants])

  function pick(idx: number, value: string) {
    setSelected((prev) => {
      const next = [...prev]
      next[idx] = value
      return next
    })
  }

  return (
    <div className="space-y-4">
      {options.map((opt, idx) => (
        <div key={opt.name} className="space-y-1.5">
          <p className="text-sm font-medium">{opt.name}</p>
          <div className="flex flex-wrap gap-2">
            {opt.values.map((value) => {
              const active = selected[idx] === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => pick(idx, value)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition ${
                    active
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:border-foreground/40'
                  }`}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex items-end justify-between border-t pt-3">
        <div>
          <p className="text-xs text-muted-foreground">ราคา</p>
          <p className="text-2xl font-semibold">
            {matched ? `฿${fmtBaht(matched.price)}` : '—'}
          </p>
        </div>
        {matched ? (
          <p className="text-xs text-muted-foreground">{matched.title}</p>
        ) : (
          <p className="text-xs text-destructive">ไม่มี variant ที่เลือก</p>
        )}
      </div>

      {matched ? (
        matched.stock !== null && matched.stock <= 0 ? (
          <p className="rounded-md border bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
            สินค้าหมด
          </p>
        ) : (
          <>
            {matched.stock !== null && matched.stock <= 5 ? (
              <p className="text-xs text-orange-600">เหลือ {matched.stock} ชิ้นเท่านั้น</p>
            ) : null}
            <AddToCartButton variantId={matched.id} />
          </>
        )
      ) : (
        <button
          type="button"
          disabled
          className="w-full rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          เลือกตัวเลือกให้ครบก่อน
        </button>
      )}
    </div>
  )
}
