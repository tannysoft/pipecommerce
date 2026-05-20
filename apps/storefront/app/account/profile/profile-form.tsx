'use client'

import { Button, Input, Label } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { saveCustomerProfile } from './actions.ts'

export function ProfileForm({
  initial,
}: {
  initial: { firstName: string | null; lastName: string | null; phone: string | null; email: string }
}) {
  const [firstName, setFirstName] = useState(initial.firstName ?? '')
  const [lastName, setLastName] = useState(initial.lastName ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<
    { ok: true } | { ok: false; error: string } | null
  >(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('firstName', firstName.trim())
      fd.append('lastName', lastName.trim())
      fd.append('phone', phone.trim())
      const res = await saveCustomerProfile(fd)
      setStatus(res)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">อีเมล</Label>
        <Input id="email" value={initial.email} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          อีเมลใช้สำหรับ login — เปลี่ยนไม่ได้
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">ชื่อ</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={pending}
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">นามสกุล</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={pending}
            maxLength={80}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">เบอร์โทร</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={pending}
          placeholder="0812345678"
          maxLength={20}
        />
      </div>

      <div className="flex items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
        {status?.ok ? (
          <span className="text-sm text-emerald-600">บันทึกแล้ว</span>
        ) : null}
        {status && !status.ok ? (
          <span className="text-sm text-destructive">{status.error}</span>
        ) : null}
      </div>
    </form>
  )
}
