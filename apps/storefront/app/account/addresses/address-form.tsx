'use client'

import { Button, Checkbox, Input, Label } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { createAddress, updateAddress } from './actions.ts'

type AddressInitial = {
  id?: string
  label?: string | null
  recipientName?: string
  phone?: string | null
  line1?: string
  line2?: string | null
  subdistrict?: string | null
  district?: string | null
  province?: string
  postalCode?: string
  isDefault?: boolean
}

export function AddressForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: AddressInitial
  onSaved?: () => void
  onCancel?: () => void
}) {
  const isEdit = Boolean(initial?.id)
  const [v, setV] = useState({
    label: initial?.label ?? '',
    recipientName: initial?.recipientName ?? '',
    phone: initial?.phone ?? '',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    subdistrict: initial?.subdistrict ?? '',
    district: initial?.district ?? '',
    province: initial?.province ?? '',
    postalCode: initial?.postalCode ?? '',
    isDefault: initial?.isDefault ?? false,
  })
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function set(k: keyof typeof v, val: string | boolean) {
    setV((s) => ({ ...s, [k]: val }))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      Object.entries(v).forEach(([k, val]) => {
        fd.append(k, typeof val === 'boolean' ? (val ? 'on' : '') : val)
      })
      const res = isEdit && initial?.id
        ? await updateAddress(initial.id, fd)
        : await createAddress(fd)
      if (!res.ok) setError(res.error)
      else onSaved?.()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>ป้ายชื่อ (ไม่บังคับ)</Label>
        <Input
          placeholder="บ้าน / ที่ทำงาน"
          value={v.label}
          onChange={(e) => set('label', e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>ชื่อผู้รับ *</Label>
          <Input
            value={v.recipientName}
            onChange={(e) => set('recipientName', e.target.value)}
            disabled={pending}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>เบอร์โทร</Label>
          <Input
            type="tel"
            value={v.phone}
            onChange={(e) => set('phone', e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>ที่อยู่ *</Label>
        <Input
          placeholder="บ้านเลขที่ / หมู่บ้าน / ถนน"
          value={v.line1}
          onChange={(e) => set('line1', e.target.value)}
          disabled={pending}
          required
        />
        <Input
          placeholder="ซอย / อาคาร / ชั้น (ไม่บังคับ)"
          value={v.line2}
          onChange={(e) => set('line2', e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>ตำบล/แขวง</Label>
          <Input
            value={v.subdistrict}
            onChange={(e) => set('subdistrict', e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label>อำเภอ/เขต</Label>
          <Input
            value={v.district}
            onChange={(e) => set('district', e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>จังหวัด *</Label>
          <Input
            value={v.province}
            onChange={(e) => set('province', e.target.value)}
            disabled={pending}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>รหัสไปรษณีย์ *</Label>
          <Input
            value={v.postalCode}
            onChange={(e) => set('postalCode', e.target.value)}
            disabled={pending}
            maxLength={10}
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isDefault"
          checked={v.isDefault}
          onCheckedChange={(c) => set('isDefault', Boolean(c))}
          disabled={pending}
        />
        <Label htmlFor="isDefault" className="font-normal">
          ตั้งเป็นที่อยู่หลัก
        </Label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 border-t pt-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'เพิ่มที่อยู่'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            ยกเลิก
          </Button>
        ) : null}
      </div>
    </form>
  )
}
