'use client'

import { Button, Input, Label, Textarea } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { createCollection } from '../actions.ts'

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function NewCollectionForm({ shopSlug }: { shopSlug: string }) {
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
      const res = await createCollection(shopSlug, formData)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">ชื่อ Collection</Label>
        <Input
          id="title"
          name="title"
          required
          disabled={pending}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="เช่น สินค้าใหม่, ลดราคา"
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">คำอธิบาย</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          disabled={pending}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending || !title || !handle}>
        {pending ? 'กำลังสร้าง...' : 'สร้าง Collection'}
      </Button>
    </form>
  )
}
