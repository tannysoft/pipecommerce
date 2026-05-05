'use client'

import { Button, Input, Label } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { sendMagicLink } from './actions.ts'

export function LoginForm({ next }: { next: string }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok?: boolean; email?: string; error?: string } | null>(
    null,
  )

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await sendMagicLink(formData)
      setResult(res)
    })
  }

  if (result?.ok) {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">📧 ส่งลิงก์ไปที่ {result.email} แล้ว</p>
        <p className="text-muted-foreground">เปิดเมล แล้วคลิกลิงก์เพื่อเข้าระบบ</p>
      </div>
    )
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="email">อีเมล</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          placeholder="you@example.com"
        />
      </div>
      {result?.error ? (
        <p className="text-sm text-destructive">{result.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'กำลังส่ง...' : 'ส่งลิงก์เข้าใช้งาน'}
      </Button>
    </form>
  )
}
