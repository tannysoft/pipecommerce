'use client'

import { Button, Label, Select } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { groupedFontOptions } from '@/lib/fonts.ts'
import { updateShopFonts } from './actions.ts'

const groups = groupedFontOptions()

function FontSelect({
  id,
  name,
  defaultValue,
  disabled,
}: {
  id: string
  name: string
  defaultValue: string
  disabled?: boolean
}) {
  return (
    <Select
      id={id}
      name={name}
      defaultValue={defaultValue}
      disabled={disabled}
    >
      {groups.map((g) => (
        <optgroup key={g.group} label={g.label}>
          {g.options.map((f) => (
            <option key={f.key} value={f.key}>
              {f.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  )
}

export function TypographyForm({
  shopSlug,
  initial,
}: {
  shopSlug: string
  initial: { heading: string; body: string }
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function onSubmit(formData: FormData) {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updateShopFonts(shopSlug, formData)
      if (!res.ok) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="heading">Heading font</Label>
        <FontSelect
          id="heading"
          name="heading"
          defaultValue={initial.heading}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">ใช้กับ h1, h2, h3, ...</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Body font</Label>
        <FontSelect id="body" name="body" defaultValue={initial.body} disabled={pending} />
        <p className="text-xs text-muted-foreground">
          ใช้กับเนื้อหาทั่วไป + UI elements ของ storefront
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'กำลังบันทึก...' : 'บันทึก'}
      </Button>

      <p className="text-xs text-muted-foreground">
        ⚡ ลูกค้าใหม่จะเห็นทันที — ลูกค้าที่เปิด storefront ค้างอยู่ refresh หน้าเพื่อเห็น
      </p>
    </form>
  )
}
