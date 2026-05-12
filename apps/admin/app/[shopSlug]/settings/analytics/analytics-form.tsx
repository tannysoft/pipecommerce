'use client'

import { Button, Input, Label } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { saveAnalyticsSettings } from './actions.ts'

export function AnalyticsForm({
  shopSlug,
  initial,
}: {
  shopSlug: string
  initial: { ga4MeasurementId: string | null; metaPixelId: string | null }
}) {
  const [ga4, setGa4] = useState(initial.ga4MeasurementId ?? '')
  const [pixel, setPixel] = useState(initial.metaPixelId ?? '')
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<
    { ok: true } | { ok: false; error: string } | null
  >(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('ga4MeasurementId', ga4.trim())
      fd.append('metaPixelId', pixel.trim())
      const res = await saveAnalyticsSettings(shopSlug, fd)
      setStatus(res)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="ga4">Google Analytics 4 — Measurement ID</Label>
        <Input
          id="ga4"
          value={ga4}
          onChange={(e) => setGa4(e.target.value)}
          placeholder="G-XXXXXXXXXX"
          maxLength={20}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          หาที่{' '}
          <a
            href="https://analytics.google.com/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Google Analytics
          </a>{' '}
          → Admin → Data Streams → Web → Measurement ID
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pixel">Meta (Facebook) Pixel ID</Label>
        <Input
          id="pixel"
          value={pixel}
          onChange={(e) => setPixel(e.target.value)}
          placeholder="1234567890"
          maxLength={20}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          หาที่{' '}
          <a
            href="https://business.facebook.com/events_manager"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Meta Events Manager
          </a>{' '}
          → Data Sources → เลือก Pixel → Settings → Pixel ID
        </p>
      </div>

      <div className="flex items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
        {status?.ok ? (
          <span className="text-sm text-emerald-600">บันทึกแล้ว ✓</span>
        ) : null}
        {status && !status.ok ? (
          <span className="text-sm text-destructive">{status.error}</span>
        ) : null}
      </div>
    </form>
  )
}
