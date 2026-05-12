'use client'

import { Button } from '@pipecommerce/ui'
import { useRef, useState, useTransition } from 'react'
import { ConfirmDialog } from '../../../_components/confirm-dialog.tsx'
import { removeShopLogo, uploadShopLogo } from './actions.ts'

export function LogoUploader({
  shopSlug,
  currentUrl,
}: {
  shopSlug: string
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
      const res = await uploadShopLogo(shopSlug, formData)
      if (!res.ok) setError(res.error)
    })
  }

  function onRemove() {
    startTransition(async () => {
      await removeShopLogo(shopSlug)
    })
  }

  return (
    <div className="space-y-2">
      {currentUrl ? (
        <div className="space-y-2">
          <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentUrl}
              alt="logo"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPick}
              disabled={pending}
            >
              {pending ? '...' : 'เปลี่ยนโลโก้'}
            </Button>
            <ConfirmDialog
              title="ลบโลโก้?"
              confirmLabel="ลบ"
              pending={pending}
              onConfirm={onRemove}
            >
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
              >
                ลบ
              </Button>
            </ConfirmDialog>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={pending}
          className="flex h-32 w-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
        >
          {pending ? '...' : '+ อัปโหลด'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        onChange={onChange}
        className="hidden"
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        JPG / PNG / WebP / SVG · สูงสุด 2 MB · แนะนำสี่เหลี่ยมจัตุรัส
      </p>
    </div>
  )
}
