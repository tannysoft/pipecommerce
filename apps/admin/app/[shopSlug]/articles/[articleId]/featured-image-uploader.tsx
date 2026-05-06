'use client'

import { Button } from '@pipecommerce/ui'
import { useRef, useState, useTransition } from 'react'
import { removeArticleFeaturedImage, uploadArticleFeaturedImage } from './image-actions.ts'

export function FeaturedImageUploader({
  shopSlug,
  articleId,
  currentUrl,
}: {
  shopSlug: string
  articleId: string
  currentUrl: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function onPick() {
    setError(null)
    inputRef.current?.click()
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    e.target.value = ''
    startTransition(async () => {
      const res = await uploadArticleFeaturedImage(shopSlug, articleId, formData)
      if (!res.ok) setError(res.error)
    })
  }

  function onRemove() {
    if (!confirm('ลบ featured image?')) return
    startTransition(async () => {
      await removeArticleFeaturedImage(shopSlug, articleId)
    })
  }

  return (
    <div className="space-y-2">
      {currentUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt="featured"
            className="aspect-video w-full rounded-lg border object-cover"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onPick} disabled={pending}>
              {pending ? '...' : 'เปลี่ยนรูป'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onRemove}
              disabled={pending}
            >
              ลบ
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={pending}
          className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
        >
          {pending ? '...' : '+ อัปโหลด featured image'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={onChange}
        className="hidden"
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">JPG / PNG / WebP / AVIF · สูงสุด 8 MB</p>
    </div>
  )
}
