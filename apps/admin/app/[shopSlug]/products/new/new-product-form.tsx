'use client'

import { Button, Input, Label } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { createProduct } from '../actions.ts'

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function NewProductForm({ shopSlug }: { shopSlug: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [handle, setHandle] = useState('')
  const [handleTouched, setHandleTouched] = useState(false)

  function onTitleChange(v: string) {
    setTitle(v)
    if (!handleTouched) setHandle(slugify(v))
  }

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createProduct(shopSlug, formData)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">ชื่อสินค้า</Label>
        <Input
          id="title"
          name="title"
          required
          disabled={pending}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="handle">URL handle</Label>
        <Input
          id="handle"
          name="handle"
          required
          disabled={pending}
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value.toLowerCase())
            setHandleTouched(true)
          }}
          pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
          maxLength={60}
        />
        <p className="text-xs text-muted-foreground">a-z, 0-9, - เท่านั้น</p>
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
          placeholder="0.00"
        />
        <p className="text-xs text-muted-foreground">
          ราคาเริ่มต้น — เพิ่ม variant + ราคาแยกได้ทีหลัง
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">คำอธิบาย</Label>
        <textarea
          id="description"
          name="description"
          rows={4}
          disabled={pending}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Status</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="status" value="draft" defaultChecked />
            Draft (ไม่เผยแพร่)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="status" value="active" />
            Active (เผยแพร่)
          </label>
        </div>
      </fieldset>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !title || !handle}>
          {pending ? 'กำลังสร้าง...' : 'สร้างสินค้า'}
        </Button>
      </div>
    </form>
  )
}
