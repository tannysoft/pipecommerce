'use client'

import { Button, Input, Label, Textarea } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { archiveProduct, unarchiveProduct, updateProduct } from '../actions.ts'

type Product = {
  id: string
  title: string
  handle: string
  description: string | null
  status: string
  tags: string[]
}

export function ProductEditForm({
  shopSlug,
  product,
  price,
}: {
  shopSlug: string
  product: Product
  price: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [archivePending, startArchive] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function onSubmit(formData: FormData) {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updateProduct(shopSlug, product.id, formData)
      if (!res.ok) setError(res.error)
      else setSaved(true)
    })
  }

  function onArchiveToggle() {
    const isArchived = product.status === 'archived'
    if (!isArchived && !confirm('Archive สินค้านี้? ลูกค้าจะไม่เห็นในหน้า storefront')) return
    startArchive(async () => {
      if (isArchived) {
        await unarchiveProduct(shopSlug, product.id)
      } else {
        await archiveProduct(shopSlug, product.id)
      }
    })
  }

  return (
    <div className="space-y-4">
      <form action={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">ชื่อสินค้า</Label>
          <Input
            id="title"
            name="title"
            required
            disabled={pending}
            defaultValue={product.title}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="handle">URL handle</Label>
          <Input
            id="handle"
            name="handle"
            required
            disabled={pending}
            defaultValue={product.handle}
            pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground">
            ⚠ การเปลี่ยน handle จะทำให้ URL เก่าเสีย (อนาคต system จะ auto-create 301 redirect)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">ราคา (บาท)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            disabled={pending}
            defaultValue={price ?? ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">คำอธิบาย</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            disabled={pending}
            defaultValue={product.description ?? ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            name="tags"
            disabled={pending}
            defaultValue={product.tags.join(', ')}
            placeholder="summer, sale, new"
          />
          <p className="text-xs text-muted-foreground">คั่นด้วย comma · ปัจจุบัน {product.tags.length} tags</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Status</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="draft"
                defaultChecked={product.status === 'draft'}
              />
              Draft
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="active"
                defaultChecked={product.status === 'active'}
              />
              Active
            </label>
            {product.status === 'archived' ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="radio" name="status" value="archived" defaultChecked disabled />
                Archived (ใช้ปุ่มด้านล่าง toggle)
              </label>
            ) : null}
          </div>
        </fieldset>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {product.status === 'archived' ? 'สินค้านี้ถูก archive แล้ว' : 'Archive แทนการลบ'}
        </p>
        <Button
          type="button"
          variant={product.status === 'archived' ? 'outline' : 'destructive'}
          size="sm"
          disabled={archivePending}
          onClick={onArchiveToggle}
        >
          {archivePending
            ? '...'
            : product.status === 'archived'
              ? 'Unarchive'
              : 'Archive'}
        </Button>
      </div>
    </div>
  )
}
