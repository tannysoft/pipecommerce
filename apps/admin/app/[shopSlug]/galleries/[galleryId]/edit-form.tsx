'use client'

import { Button, Input, Label, Textarea } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { deleteGallery, updateGallery } from '../actions.ts'

type Gallery = {
  id: string
  title: string
  handle: string
  description: string | null
  status: string
  seoTitle: string | null
  seoDescription: string | null
}

export function GalleryEditForm({ shopSlug, gallery }: { shopSlug: string; gallery: Gallery }) {
  const [pending, startTransition] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function onSubmit(formData: FormData) {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updateGallery(shopSlug, gallery.id, formData)
      if (!res.ok) setError(res.error)
      else setSaved(true)
    })
  }

  function onDelete() {
    if (!confirm('ลบ gallery นี้? รูปทั้งหมดจะถูกลบด้วย')) return
    startDelete(async () => {
      await deleteGallery(shopSlug, gallery.id)
    })
  }

  return (
    <div className="space-y-4">
      <form action={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required disabled={pending} defaultValue={gallery.title} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="handle">URL handle</Label>
          <Input
            id="handle"
            name="handle"
            required
            disabled={pending}
            defaultValue={gallery.handle}
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
            defaultValue={gallery.description ?? ''}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Status</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="draft"
                defaultChecked={gallery.status === 'draft'}
              />
              Draft
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="active"
                defaultChecked={gallery.status === 'active'}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="archived"
                defaultChecked={gallery.status === 'archived'}
              />
              Archived
            </label>
          </div>
        </fieldset>

        <details
          className="rounded-lg border p-3 text-sm"
          open={!!gallery.seoTitle || !!gallery.seoDescription}
        >
          <summary className="cursor-pointer font-medium">SEO</summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="seoTitle">SEO Title</Label>
              <Input
                id="seoTitle"
                name="seoTitle"
                disabled={pending}
                defaultValue={gallery.seoTitle ?? ''}
                maxLength={70}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="seoDescription">SEO Description</Label>
              <Textarea
                id="seoDescription"
                name="seoDescription"
                rows={2}
                maxLength={160}
                disabled={pending}
                defaultValue={gallery.seoDescription ?? ''}
              />
            </div>
          </div>
        </details>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </form>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">ลบ gallery + รูปทั้งหมด</p>
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
