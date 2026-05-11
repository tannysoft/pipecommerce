'use client'

import {
  Button,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { saveProductOptions, setVariantStock, updateVariant } from './variant-actions.ts'

type Option = { name: string; values: string[] }
type Variant = {
  id: string
  title: string
  option1: string | null
  option2: string | null
  option3: string | null
  price: string
  sku: string | null
  stock: number | null // null = untracked, number = available count
}

type Props = {
  shopSlug: string
  productId: string
  options: Option[]
  variants: Variant[]
}

export function VariantsManager({ shopSlug, productId, options, variants }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [draft, setDraft] = useState<Option[]>(() => {
    const padded = [...options]
    while (padded.length < 3) padded.push({ name: '', values: [] })
    return padded
  })

  function setOptionField(idx: number, field: 'name' | 'valuesText', value: string) {
    setDraft((prev) =>
      prev.map((opt, i) => {
        if (i !== idx) return opt
        if (field === 'name') return { ...opt, name: value }
        return {
          ...opt,
          values: value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        }
      }),
    )
  }

  function onSaveOptions() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const fd = new FormData()
      for (let i = 0; i < draft.length && i < 3; i++) {
        const opt = draft[i]!
        if (opt.name && opt.values.length > 0) {
          fd.append(`option${i + 1}Name`, opt.name)
          fd.append(`option${i + 1}Values`, opt.values.join(','))
        }
      }
      const res = await saveProductOptions(shopSlug, productId, fd)
      if (!res.ok) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-medium">ตัวเลือกสินค้า (สูงสุด 3)</h3>
        <p className="text-xs text-muted-foreground">
          ใส่ชื่อ option (เช่น Size, Color) + values คั่นด้วย comma · เว้นว่างไว้ = ไม่มี option นั้น
        </p>

        {draft.map((opt, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-[180px_1fr]">
            <div className="space-y-1">
              <Label htmlFor={`opt-name-${idx}`} className="text-xs">
                Option {idx + 1}
              </Label>
              <Input
                id={`opt-name-${idx}`}
                value={opt.name}
                onChange={(e) => setOptionField(idx, 'name', e.target.value)}
                placeholder={idx === 0 ? 'เช่น Size' : idx === 1 ? 'เช่น Color' : 'เช่น Material'}
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`opt-values-${idx}`} className="text-xs">
                Values (คั่น , )
              </Label>
              <Input
                id={`opt-values-${idx}`}
                value={opt.values.join(', ')}
                onChange={(e) => setOptionField(idx, 'valuesText', e.target.value)}
                placeholder={idx === 0 ? 'S, M, L' : idx === 1 ? 'Red, Blue' : ''}
                disabled={pending}
              />
            </div>
          </div>
        ))}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? (
          <p className="text-sm text-green-600">บันทึก + regenerate variants แล้ว ✓</p>
        ) : null}

        <Button type="button" onClick={onSaveOptions} disabled={pending}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก + Regenerate Variants'}
        </Button>
      </section>

      <section className="space-y-3 border-t pt-4">
        <h3 className="font-medium">Variants ({variants.length})</h3>
        {variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มี variant</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Stock: เว้นว่าง = ไม่ track stock (ขายได้เสมอ) · ใส่ตัวเลข = track + จะหมดเมื่อขายครบ
            </p>
            <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variant</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Price (บาท)</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((v) => (
                  <VariantRow
                    key={v.id}
                    shopSlug={shopSlug}
                    productId={productId}
                    variant={v}
                    pending={pending}
                  />
                ))}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function VariantRow({
  shopSlug,
  productId,
  variant,
  pending: parentPending,
}: {
  shopSlug: string
  productId: string
  variant: Variant
  pending: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [price, setPrice] = useState(variant.price)
  const [sku, setSku] = useState(variant.sku ?? '')
  const [stock, setStock] = useState(
    variant.stock === null ? '' : String(variant.stock),
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('price', price)
      fd.append('sku', sku)
      const res = await updateVariant(shopSlug, productId, variant.id, fd)
      if (!res.ok) {
        setError(res.error)
        return
      }
      const stockTrim = stock.trim()
      const stockValue = stockTrim === '' ? null : Number(stockTrim)
      const initialStock = variant.stock === null ? '' : String(variant.stock)
      if (stock !== initialStock) {
        const stockRes = await setVariantStock(shopSlug, productId, variant.id, stockValue)
        if (!stockRes.ok) {
          setError(stockRes.error)
          return
        }
      }
      setSaved(true)
    })
  }

  const initialStock = variant.stock === null ? '' : String(variant.stock)
  const dirty =
    price !== variant.price || sku !== (variant.sku ?? '') || stock !== initialStock
  const disabled = pending || parentPending

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{variant.title}</p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {saved ? <p className="text-xs text-green-600">บันทึก ✓</p> : null}
      </TableCell>
      <TableCell>
        <Input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          disabled={disabled}
          className="h-8 max-w-[160px]"
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={disabled}
          className="ml-auto h-8 max-w-[120px] text-right tabular-nums"
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step="1"
          min="0"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          disabled={disabled}
          placeholder="ไม่ track"
          className="ml-auto h-8 max-w-[100px] text-right tabular-nums"
        />
      </TableCell>
      <TableCell>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={disabled || !dirty}
        >
          {pending ? '...' : 'บันทึก'}
        </Button>
      </TableCell>
    </TableRow>
  )
}
