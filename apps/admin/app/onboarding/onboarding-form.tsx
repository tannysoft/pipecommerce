'use client'

import { Button, Input, Label } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { createShop } from './actions.ts'

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
}

export function OnboardingForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  function onNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createShop(formData)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">ชื่อร้าน</Label>
        <Input
          id="name"
          name="name"
          required
          disabled={pending}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="ร้านน่ารัก"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">URL ของร้าน</Label>
        <Input
          id="slug"
          name="slug"
          required
          disabled={pending}
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value.toLowerCase())
            setSlugTouched(true)
          }}
          pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
          minLength={3}
          maxLength={30}
          placeholder="my-shop"
        />
        <p className="text-xs text-muted-foreground">a-z, 0-9, - เท่านั้น (3-30 ตัว)</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending || !name || !slug}>
        {pending ? 'กำลังสร้าง...' : 'สร้างร้าน'}
      </Button>
    </form>
  )
}
