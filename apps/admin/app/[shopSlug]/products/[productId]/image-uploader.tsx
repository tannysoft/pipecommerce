'use client'

import { Button } from '@pipecommerce/ui'
import { useRef, useState, useTransition } from 'react'
import { deleteProductImage, uploadProductImage } from './image-actions.ts'

type Image = {
  id: string
  publicUrl: string
  alt: string | null
  bytes: number | null
}

export function ImageUploader({
  shopSlug,
  productId,
  images,
}: {
  shopSlug: string
  productId: string
  images: Image[]
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
    e.target.value = '' // reset

    startTransition(async () => {
      const res = await uploadProductImage(shopSlug, productId, formData)
      if (!res.ok) setError(res.error)
    })
  }

  function onDelete(imageId: string) {
    if (!confirm('ลบรูปนี้?')) return
    startTransition(async () => {
      await deleteProductImage(shopSlug, productId, imageId)
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((img) => (
          <div key={img.id} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.publicUrl}
              alt={img.alt ?? ''}
              className="aspect-square w-full rounded-lg border object-cover"
            />
            <button
              type="button"
              onClick={() => onDelete(img.id)}
              disabled={pending}
              className="absolute right-1 top-1 rounded-md bg-background/90 px-2 py-0.5 text-xs opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
            >
              ลบ
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onPick}
          disabled={pending}
          className="flex aspect-square items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground transition hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
        >
          {pending ? '...' : '+ อัปโหลด'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={onChange}
        className="hidden"
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        JPG / PNG / WebP / AVIF · สูงสุด 8 MB
      </p>
    </div>
  )
}
