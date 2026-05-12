'use client'

import { ArrowDown, ArrowUp, Star, X } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ConfirmDialog } from '../../../_components/confirm-dialog.tsx'
import {
  deleteProductImage,
  reorderProductImages,
  uploadProductImage,
} from './image-actions.ts'

type Image = {
  id: string
  publicUrl: string
  alt: string | null
  bytes: number | null
}

export function ImageUploader({
  shopSlug,
  productId,
  images: serverImages,
}: {
  shopSlug: string
  productId: string
  images: Image[]
}) {
  const [images, setImages] = useState<Image[]>(serverImages)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync กลับเมื่อ server props เปลี่ยน (เช่น หลัง upload → revalidatePath)
  useEffect(() => {
    setImages(serverImages)
  }, [serverImages])

  function onPick() {
    setError(null)
    inputRef.current?.click()
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    startTransition(async () => {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await uploadProductImage(shopSlug, productId, formData)
        if (!res.ok) {
          setError(res.error)
          break
        }
      }
    })
  }

  function onDelete(imageId: string) {
    startTransition(async () => {
      await deleteProductImage(shopSlug, productId, imageId)
    })
  }

  function move(idx: number, delta: -1 | 1) {
    const j = idx + delta
    if (j < 0 || j >= images.length) return
    const next = images.slice()
    ;[next[idx], next[j]] = [next[j]!, next[idx]!]
    setImages(next)
    startTransition(async () => {
      const res = await reorderProductImages(
        shopSlug,
        productId,
        next.map((i) => i.id),
      )
      if (!res.ok) setImages(serverImages) // rollback
    })
  }

  function setCover(idx: number) {
    if (idx === 0) return
    const next = [images[idx]!, ...images.filter((_, i) => i !== idx)]
    setImages(next)
    startTransition(async () => {
      const res = await reorderProductImages(
        shopSlug,
        productId,
        next.map((i) => i.id),
      )
      if (!res.ok) setImages(serverImages)
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((img, idx) => (
          <div
            key={img.id}
            className="group relative overflow-hidden rounded-lg border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.publicUrl}
              alt={img.alt ?? ''}
              className="aspect-square w-full object-cover"
            />

            {idx === 0 ? (
              <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm">
                <Star className="size-3 fill-current" /> ปก
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setCover(idx)}
                disabled={pending}
                title="ตั้งเป็นรูปปก"
                className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-0.5 text-xs opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground"
              >
                <Star className="size-3" /> ตั้งเป็นปก
              </button>
            )}

            <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0 || pending}
                aria-label="เลื่อนซ้าย"
                className="rounded-md bg-background/90 p-1 shadow-sm hover:bg-accent disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                disabled={idx === images.length - 1 || pending}
                aria-label="เลื่อนขวา"
                className="rounded-md bg-background/90 p-1 shadow-sm hover:bg-accent disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" />
              </button>
              <ConfirmDialog
                title="ลบรูปนี้?"
                confirmLabel="ลบ"
                pending={pending}
                onConfirm={() => onDelete(img.id)}
              >
                <button
                  type="button"
                  disabled={pending}
                  aria-label="ลบ"
                  className="rounded-md bg-background/90 p-1 shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </ConfirmDialog>
            </div>
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
        multiple
        onChange={onChange}
        className="hidden"
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        JPG / PNG / WebP / AVIF · สูงสุด 8 MB/ไฟล์ · รูปแรก = รูปปก · เลือกหลายไฟล์ได้
      </p>
    </div>
  )
}
