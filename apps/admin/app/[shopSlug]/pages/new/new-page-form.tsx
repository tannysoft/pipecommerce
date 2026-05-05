'use client'

import { Button, Input, Label } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { createPage } from '../actions.ts'

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

export function NewPageForm({ shopSlug }: { shopSlug: string }) {
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
      const res = await createPage(shopSlug, formData)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          disabled={pending}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="เช่น About Us, Privacy Policy"
        />
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
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value.toLowerCase())
              setHandleTouched(true)
            }}
            pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
            maxLength={60}
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">เนื้อหา</Label>
        <textarea
          id="body"
          name="body"
          rows={10}
          disabled={pending}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="ใส่ข้อความ — รองรับ HTML basic"
        />
        <p className="text-xs text-muted-foreground">รองรับ HTML — rich-text editor มาทีหลัง</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Status</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="status" value="draft" defaultChecked />
            Draft
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="status" value="active" />
            Active (เผยแพร่)
          </label>
        </div>
      </fieldset>

      <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium">SEO (optional)</summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="seoTitle">SEO Title</Label>
            <Input
              id="seoTitle"
              name="seoTitle"
              disabled={pending}
              maxLength={70}
              placeholder="ใช้ title หลักถ้าไม่ตั้ง"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seoDescription">SEO Description</Label>
            <textarea
              id="seoDescription"
              name="seoDescription"
              rows={2}
              maxLength={160}
              disabled={pending}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </details>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending || !title || !handle}>
        {pending ? 'กำลังสร้าง...' : 'สร้าง Page'}
      </Button>
    </form>
  )
}
