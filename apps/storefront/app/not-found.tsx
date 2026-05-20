import Link from 'next/link'
import { Button } from '@pipecommerce/ui'
import { lookupShopByHost, resolveShopHost } from '@/lib/shop.ts'

export const metadata = { title: 'ไม่พบหน้านี้' }

export default async function NotFound() {
  const host = await resolveShopHost()
  const shop = host ? await lookupShopByHost(host) : null

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">ไม่พบหน้านี้</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        ลิงก์อาจหมดอายุ หรือถูกลบไปแล้ว
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link href="/">กลับหน้าแรก</Link>
        </Button>
        {shop ? (
          <Button variant="outline" asChild>
            <Link href="/products">ดูสินค้า</Link>
          </Button>
        ) : null}
      </div>
    </main>
  )
}
