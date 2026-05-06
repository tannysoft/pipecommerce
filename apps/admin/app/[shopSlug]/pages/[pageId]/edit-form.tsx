'use client'

import { Button, Input, Label, Textarea } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { deletePage, updatePage } from '../actions.ts'

type Page = {
  id: string
  title: string
  handle: string
  body: string | null
  status: string
  seoTitle: string | null
  seoDescription: string | null
}

export function PageEditForm({ shopSlug, page }: { shopSlug: string; page: Page }) {
  const [pending, startTransition] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function onSubmit(formData: FormData) {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updatePage(shopSlug, page.id, formData)
      if (!res.ok) setError(res.error)
      else setSaved(true)
    })
  }

  function onDelete() {
    if (!confirm('ลบ page นี้?')) return
    startDelete(async () => {
      await deletePage(shopSlug, page.id)
    })
  }

  return (
    <div className="space-y-4">
      <form action={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required disabled={pending} defaultValue={page.title} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="handle">URL handle</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/pages/</span>
            <Input
              id="handle"
              name="handle"
              required
              disabled={pending}
              defaultValue={page.handle}
              pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
              maxLength={60}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">เนื้อหา</Label>
          <Textarea
            id="body"
            name="body"
            rows={12}
            disabled={pending}
            defaultValue={page.body ?? ''}
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
                defaultChecked={page.status === 'draft'}
              />
              Draft
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="active"
                defaultChecked={page.status === 'active'}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="archived"
                defaultChecked={page.status === 'archived'}
              />
              Archived
            </label>
          </div>
        </fieldset>

        <details className="rounded-lg border p-3 text-sm" open={!!page.seoTitle || !!page.seoDescription}>
          <summary className="cursor-pointer font-medium">SEO</summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="seoTitle">SEO Title</Label>
              <Input
                id="seoTitle"
                name="seoTitle"
                disabled={pending}
                defaultValue={page.seoTitle ?? ''}
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
                defaultValue={page.seoDescription ?? ''}
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
        <p className="text-sm text-muted-foreground">ลบ page นี้ (soft delete)</p>
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
