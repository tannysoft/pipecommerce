'use client'

import { Button } from '@pipecommerce/ui'
import Link from 'next/link'
import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[admin] error boundary:', error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-destructive">
        500
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">เกิดข้อผิดพลาด</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        ระบบขัดข้อง — ลองโหลดหน้าใหม่อีกครั้ง
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          รหัส: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>ลองใหม่</Button>
        <Button variant="outline" asChild>
          <Link href="/">กลับหน้าแรก</Link>
        </Button>
      </div>
    </main>
  )
}
