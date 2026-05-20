'use client'

import { Button } from '@pipecommerce/ui'
import Link from 'next/link'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[storefront] error boundary:', error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        500
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">เกิดข้อผิดพลาด</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        ระบบกำลังขัดข้อง ลองรีเฟรชหน้าใหม่อีกครั้ง
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          รหัสอ้างอิง: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>ลองอีกครั้ง</Button>
        <Button variant="outline" asChild>
          <Link href="/">กลับหน้าแรก</Link>
        </Button>
      </div>
    </main>
  )
}
