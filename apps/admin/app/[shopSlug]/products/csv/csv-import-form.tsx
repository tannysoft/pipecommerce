'use client'

import { Button, Input } from '@pipecommerce/ui'
import { useRef, useState, useTransition } from 'react'
import { type ImportResult, importProductsCsv } from './actions.ts'

export function CsvImportForm({ shopSlug }: { shopSlug: string }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResult(null)
    const file = fileRef.current?.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      const res = await importProductsCsv(shopSlug, fd)
      setResult(res)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input ref={fileRef} type="file" accept=".csv,text/csv" disabled={pending} required />
      <Button type="submit" disabled={pending}>
        {pending ? 'กำลังนำเข้า...' : 'นำเข้า'}
      </Button>

      {result ? (
        result.ok ? (
          <div className="rounded-md border bg-green-50 p-3 text-sm">
            <p>
              สร้างใหม่ {result.created} · อัปเดต {result.updated}
              {result.skipped > 0 ? ` · ข้าม ${result.skipped}` : ''}
            </p>
            {result.errors.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-destructive">
                  มี {result.errors.length} error
                </summary>
                <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs text-destructive">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-destructive">{result.error}</p>
        )
      ) : null}
    </form>
  )
}
