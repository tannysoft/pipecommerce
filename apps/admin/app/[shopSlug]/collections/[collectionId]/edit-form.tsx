'use client'

import { Button, Input, Label, Textarea } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { deleteCollection, updateCollection } from '../actions.ts'

type Collection = {
  id: string
  title: string
  handle: string
  description: string | null
}

export function CollectionEditForm({
  shopSlug,
  collection,
}: {
  shopSlug: string
  collection: Collection
}) {
  const [pending, startTransition] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function onSubmit(formData: FormData) {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updateCollection(shopSlug, collection.id, formData)
      if (!res.ok) setError(res.error)
      else setSaved(true)
    })
  }

  function onDelete() {
    if (!confirm('ลบ collection นี้? สินค้าใน collection จะไม่ถูกลบ — แค่ unlink')) return
    startDelete(async () => {
      await deleteCollection(shopSlug, collection.id)
    })
  }

  return (
    <div className="space-y-4">
      <form action={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">ชื่อ Collection</Label>
          <Input id="title" name="title" required disabled={pending} defaultValue={collection.title} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="handle">URL handle</Label>
          <Input
            id="handle"
            name="handle"
            required
            disabled={pending}
            defaultValue={collection.handle}
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
            defaultValue={collection.description ?? ''}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </form>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">ลบ collection นี้</p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={deletePending}
          onClick={onDelete}
        >
          {deletePending ? '...' : 'Delete'}
        </Button>
      </div>
    </div>
  )
}
