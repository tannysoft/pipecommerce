'use client'

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { placeOrder } from './actions.ts'

export function CheckoutForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await placeOrder(formData)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <form action={onSubmit} className="space-y-6 rounded-xl border bg-card p-6">
      <section className="space-y-3">
        <h2 className="font-semibold">ข้อมูลติดต่อ</h2>
        <div className="space-y-2">
          <Label htmlFor="email">อีเมล</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            disabled={pending}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
          <Input id="phone" name="phone" type="tel" disabled={pending} autoComplete="tel" />
        </div>
      </section>

      <section className="space-y-3 border-t pt-6">
        <h2 className="font-semibold">ที่อยู่จัดส่ง</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">ชื่อ</Label>
            <Input
              id="firstName"
              name="firstName"
              required
              disabled={pending}
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">นามสกุล</Label>
            <Input
              id="lastName"
              name="lastName"
              disabled={pending}
              autoComplete="family-name"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="address1">ที่อยู่</Label>
          <Input
            id="address1"
            name="address1"
            required
            disabled={pending}
            autoComplete="address-line1"
            placeholder="บ้านเลขที่ ตึก ซอย ถนน"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address2">ที่อยู่เพิ่มเติม (optional)</Label>
          <Input
            id="address2"
            name="address2"
            disabled={pending}
            autoComplete="address-line2"
            placeholder="ห้อง ชั้น อาคาร"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="city">เมือง/อำเภอ</Label>
            <Input
              id="city"
              name="city"
              required
              disabled={pending}
              autoComplete="address-level2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="province">จังหวัด</Label>
            <Input
              id="province"
              name="province"
              disabled={pending}
              autoComplete="address-level1"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="postalCode">รหัสไปรษณีย์</Label>
            <Input
              id="postalCode"
              name="postalCode"
              required
              disabled={pending}
              autoComplete="postal-code"
              maxLength={10}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">ประเทศ</Label>
            <Select name="country" defaultValue="TH" disabled={pending}>
              <SelectTrigger id="country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TH">ไทย</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t pt-6">
        <Label htmlFor="note">หมายเหตุ (optional)</Label>
        <Textarea
          id="note"
          name="note"
          rows={2}
          disabled={pending}
          maxLength={500}
        />
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? 'กำลังสร้างออเดอร์...' : 'สั่งซื้อ'}
      </Button>
    </form>
  )
}
