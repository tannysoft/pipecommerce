import Link from 'next/link'
import { Button } from '@pipecommerce/ui'

export const metadata = { title: 'ไม่พบหน้านี้ — PipeCommerce' }

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">ไม่พบหน้านี้</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        ไม่มีร้าน หรือทรัพยากรนี้ในระบบ
      </p>
      <Button className="mt-6" asChild>
        <Link href="/">กลับหน้าแรก</Link>
      </Button>
    </main>
  )
}
