'use client'

import { Button, Checkbox, Input, Label } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { saveAnnouncementBar } from './actions.ts'

type Props = {
  shopSlug: string
  defaults: {
    isActive: boolean
    isDismissible: boolean
    text: string
    link: string
    linkText: string
    backgroundColor: string
    textColor: string
  }
}

export function AnnouncementBarForm({ shopSlug, defaults }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isActive, setIsActive] = useState(defaults.isActive)
  const [isDismissible, setIsDismissible] = useState(defaults.isDismissible)

  function onSubmit(formData: FormData) {
    setError(null)
    setSaved(false)
    formData.set('isActive', isActive ? 'on' : '')
    formData.set('isDismissible', isDismissible ? 'on' : '')
    startTransition(async () => {
      const res = await saveAnnouncementBar(shopSlug, formData)
      if (!res.ok) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="isActive"
          checked={isActive}
          onCheckedChange={(v) => setIsActive(Boolean(v))}
          disabled={pending}
        />
        <Label htmlFor="isActive" className="font-normal">
          เปิด announcement bar
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="text">ข้อความ</Label>
        <Input
          id="text"
          name="text"
          defaultValue={defaults.text}
          disabled={pending}
          placeholder="🎉 ส่งฟรีทั่วประเทศ — ครบ ฿1,000"
          maxLength={200}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="link">Link URL (optional)</Label>
          <Input
            id="link"
            name="link"
            type="url"
            defaultValue={defaults.link}
            disabled={pending}
            placeholder="/collections/sale"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="linkText">Link Text</Label>
          <Input
            id="linkText"
            name="linkText"
            defaultValue={defaults.linkText}
            disabled={pending}
            placeholder="ดูเลย"
            maxLength={50}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="backgroundColor">Background color (CSS)</Label>
          <Input
            id="backgroundColor"
            name="backgroundColor"
            defaultValue={defaults.backgroundColor}
            disabled={pending}
            placeholder="#000 หรือ oklch(...)"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="textColor">Text color (CSS)</Label>
          <Input
            id="textColor"
            name="textColor"
            defaultValue={defaults.textColor}
            disabled={pending}
            placeholder="#fff"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isDismissible"
          checked={isDismissible}
          onCheckedChange={(v) => setIsDismissible(Boolean(v))}
          disabled={pending}
        />
        <Label htmlFor="isDismissible" className="font-normal">
          ลูกค้าปิดได้ (× บนมุมขวา)
        </Label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'กำลังบันทึก...' : 'บันทึก'}
      </Button>
    </form>
  )
}
