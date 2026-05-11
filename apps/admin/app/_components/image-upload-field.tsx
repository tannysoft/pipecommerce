'use client'

import { Button } from '@pipecommerce/ui'
import { useRef, useState, useTransition } from 'react'
import { uploadEditorImage } from './editor-actions.ts'

type Props = {
  shopSlug: string
  value: string
  onChange: (url: string) => void
  /** preview aspect ratio class — default video (16:9) */
  aspectClass?: string
  label?: string
}

/**
 * Image upload field — แทน text input "image URL" ทั่ว admin
 * ใช้ R2 ผ่าน uploadEditorImage (server action)
 */
export function ImageUploadField({
  shopSlug,
  value,
  onChange,
  aspectClass = 'aspect-video',
  label = 'รูปภาพ',
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function pick() {
    setError(null)
    inputRef.current?.click()
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadEditorImage(shopSlug, fd)
      if (!res.ok) setError(res.error)
      else onChange(res.url)
    })
  }

  function clear() {
    onChange('')
  }

  return (
    <div className="space-y-1.5">
      {value ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className={`w-full rounded-md border object-cover ${aspectClass}`}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={pick} disabled={pending}>
              {pending ? '...' : 'เปลี่ยนรูป'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clear}
              disabled={pending}
            >
              ลบ
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={pending}
          className={`flex w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground disabled:opacity-50 ${aspectClass}`}
        >
          {pending ? '...' : `+ อัปโหลด${label}`}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        onChange={onFile}
        className="hidden"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
