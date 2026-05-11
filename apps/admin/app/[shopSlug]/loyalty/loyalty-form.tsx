'use client'

import { Button, Checkbox, Input, Label } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { saveLoyaltyProgram } from './actions.ts'

type Props = {
  shopSlug: string
  defaults: {
    name: string
    isActive: boolean
    earnRateAmount: string
    earnExcludesDiscounts: boolean
    signupBonusPoints: string
    redeemMinPoints: string
    redeemValuePerPoint: string
    redeemStep: string
    redeemMaxPctOfOrder: string
    pointsExpiryMonths: string
  }
}

export function LoyaltyForm({ shopSlug, defaults }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isActive, setIsActive] = useState(defaults.isActive)
  const [earnExcludesDiscounts, setEarnExcludesDiscounts] = useState(
    defaults.earnExcludesDiscounts,
  )

  function onSubmit(formData: FormData) {
    setError(null)
    setSaved(false)
    formData.set('isActive', isActive ? 'on' : '')
    formData.set('earnExcludesDiscounts', earnExcludesDiscounts ? 'on' : '')
    startTransition(async () => {
      const res = await saveLoyaltyProgram(shopSlug, formData)
      if (!res.ok) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">ชื่อโปรแกรม</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaults.name}
          disabled={pending}
          placeholder="Loyalty Points"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isActive"
          checked={isActive}
          onCheckedChange={(v) => setIsActive(Boolean(v))}
          disabled={pending}
        />
        <Label htmlFor="isActive" className="font-normal">
          เปิดใช้งาน loyalty program
        </Label>
      </div>

      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-2 text-sm font-medium">การได้รับแต้ม (Earn)</legend>
        <div className="space-y-2">
          <Label htmlFor="earnRateAmount">
            จำนวนเงินต่อ 1 แต้ม (บาท)
          </Label>
          <Input
            id="earnRateAmount"
            name="earnRateAmount"
            type="number"
            step="0.01"
            min="0.01"
            disabled={pending}
            defaultValue={defaults.earnRateAmount}
            placeholder="100"
          />
          <p className="text-xs text-muted-foreground">
            เช่น 100 = ทุกๆ ฿100 ได้ 1 แต้ม
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="earnExcludesDiscounts"
            checked={earnExcludesDiscounts}
            onCheckedChange={(v) => setEarnExcludesDiscounts(Boolean(v))}
            disabled={pending}
          />
          <Label htmlFor="earnExcludesDiscounts" className="font-normal">
            หักส่วนลดออกก่อนคำนวณแต้ม
          </Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="signupBonusPoints">โบนัสสมัครสมาชิก (แต้ม)</Label>
          <Input
            id="signupBonusPoints"
            name="signupBonusPoints"
            type="number"
            min="0"
            step="1"
            disabled={pending}
            defaultValue={defaults.signupBonusPoints}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-2 text-sm font-medium">การใช้แต้ม (Redeem) — ใช้ได้ใน P2</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="redeemValuePerPoint">มูลค่าต่อแต้ม (บาท)</Label>
            <Input
              id="redeemValuePerPoint"
              name="redeemValuePerPoint"
              type="number"
              step="0.0001"
              min="0"
              disabled={pending}
              defaultValue={defaults.redeemValuePerPoint}
              placeholder="0.5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="redeemMinPoints">แต้มขั้นต่ำ</Label>
            <Input
              id="redeemMinPoints"
              name="redeemMinPoints"
              type="number"
              min="1"
              step="1"
              disabled={pending}
              defaultValue={defaults.redeemMinPoints}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="redeemStep">ก้าว (แต้ม)</Label>
            <Input
              id="redeemStep"
              name="redeemStep"
              type="number"
              min="1"
              step="1"
              disabled={pending}
              defaultValue={defaults.redeemStep}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="redeemMaxPctOfOrder">ใช้ได้สูงสุด % ของยอด — optional</Label>
            <Input
              id="redeemMaxPctOfOrder"
              name="redeemMaxPctOfOrder"
              type="number"
              min="0"
              max="100"
              step="0.01"
              disabled={pending}
              defaultValue={defaults.redeemMaxPctOfOrder}
              placeholder="เช่น 50"
            />
          </div>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="pointsExpiryMonths">อายุแต้ม (เดือน) — optional</Label>
        <Input
          id="pointsExpiryMonths"
          name="pointsExpiryMonths"
          type="number"
          min="1"
          step="1"
          disabled={pending}
          defaultValue={defaults.pointsExpiryMonths}
          placeholder="เว้นว่าง = ไม่หมดอายุ"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-green-600">บันทึกแล้ว ✓</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'กำลังบันทึก...' : 'บันทึก'}
      </Button>
    </form>
  )
}
