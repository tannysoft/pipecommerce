'use client'

import { Button, Input, Label, Textarea } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { deleteArticle, updateArticle } from '../actions.ts'

type Article = {
  id: string
  title: string
  handle: string
  body: string | null
  excerpt: string | null
  authorName: string | null
  status: string
  tags: string[]
  seoTitle: string | null
  seoDescription: string | null
}

export function ArticleEditForm({
  shopSlug,
  article,
}: {
  shopSlug: string
  article: Article
}) {
  const [pending, startTransition] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function onSubmit(formData: FormData) {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updateArticle(shopSlug, article.id, formData)
      if (!res.ok) setError(res.error)
      else setSaved(true)
    })
  }

  function onDelete() {
    if (!confirm('ลบบทความนี้?')) return
    startDelete(async () => {
      await deleteArticle(shopSlug, article.id)
    })
  }

  return (
    <div className="space-y-4">
      <form action={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required disabled={pending} defaultValue={article.title} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="handle">URL handle</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/blog/</span>
            <Input
              id="handle"
              name="handle"
              required
              disabled={pending}
              defaultValue={article.handle}
              pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
              maxLength={60}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="excerpt">Excerpt</Label>
          <Textarea
            id="excerpt"
            name="excerpt"
            rows={2}
            maxLength={300}
            disabled={pending}
            defaultValue={article.excerpt ?? ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">เนื้อหา</Label>
          <Textarea
            id="body"
            name="body"
            rows={14}
            disabled={pending}
            defaultValue={article.body ?? ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="authorName">ชื่อผู้เขียน</Label>
          <Input
            id="authorName"
            name="authorName"
            disabled={pending}
            defaultValue={article.authorName ?? ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            name="tags"
            disabled={pending}
            defaultValue={article.tags.join(', ')}
            placeholder="cooking, tips"
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
                defaultChecked={article.status === 'draft'}
              />
              Draft
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="active"
                defaultChecked={article.status === 'active'}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="archived"
                defaultChecked={article.status === 'archived'}
              />
              Archived
            </label>
          </div>
        </fieldset>

        <details
          className="rounded-lg border p-3 text-sm"
          open={!!article.seoTitle || !!article.seoDescription}
        >
          <summary className="cursor-pointer font-medium">SEO</summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="seoTitle">SEO Title</Label>
              <Input
                id="seoTitle"
                name="seoTitle"
                disabled={pending}
                defaultValue={article.seoTitle ?? ''}
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
                defaultValue={article.seoDescription ?? ''}
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
        <p className="text-sm text-muted-foreground">ลบบทความ (soft delete)</p>
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
