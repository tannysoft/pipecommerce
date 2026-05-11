'use client'

import { Button, Input } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { subscribeNewsletter } from './actions.ts'

const CONSENT_TEXT =
  'ฉันยินยอมรับข่าวสารและโปรโมชั่นทางอีเมล สามารถยกเลิกได้ทุกเมื่อผ่านลิงก์ในอีเมล'

type Props = {
  source?: 'footer' | 'popup' | 'checkout'
  className?: string
}

export function NewsletterForm({ source = 'footer', className }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [consent, setConsent] = useState(false)

  function onSubmit(formData: FormData) {
    setError(null)
    if (!consent) {
      setError('กรุณายอมรับเงื่อนไขการรับข่าวสาร')
      return
    }
    formData.set('consent', CONSENT_TEXT)
    formData.set('source', source)
    startTransition(async () => {
      const res = await subscribeNewsletter(formData)
      if (!res.ok) setError(res.error)
      else setDone(true)
    })
  }

  if (done) {
    return (
      <p className={`text-sm ${className ?? ''}`}>
        ขอบคุณ! เราจะส่งข่าวสารและโปรโมชั่นให้ ✓
      </p>
    )
  }

  return (
    <form action={onSubmit} className={`space-y-2 ${className ?? ''}`}>
      <div className="flex gap-2">
        <Input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="อีเมลของคุณ"
          disabled={pending}
          className="flex-1"
        />
        <Button type="submit" disabled={pending}>
          {pending ? '...' : 'สมัคร'}
        </Button>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={pending}
          className="mt-0.5"
        />
        <span>{CONSENT_TEXT}</span>
      </label>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  )
}
