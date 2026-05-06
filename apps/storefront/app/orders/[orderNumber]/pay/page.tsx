import { and, eq } from '@pipecommerce/db'
import { orders } from '@pipecommerce/db/schema'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { isBeamConfigured } from '@/lib/beam.ts'
import { db } from '@/lib/db.ts'
import { requireShopFromHost } from '@/lib/shop.ts'
import { simulatePayment } from './actions.ts'

const fmtBaht = (raw: string | number) =>
  Number(raw).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const [{ orderNumber }, { token }] = await Promise.all([params, searchParams])
  const shop = await requireShopFromHost()
  if (!token) notFound()

  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.shopId, shop.id),
        eq(orders.orderNumber, orderNumber),
        eq(orders.trackingToken, token),
      ),
    )
    .limit(1)
  if (!order) notFound()

  // ถ้า paid แล้ว → ไปหน้า tracking ตรงๆ
  if (order.financialStatus === 'paid') {
    redirect(`/orders/${orderNumber}?token=${token}`)
  }

  // Production: ถ้า Beam configured จะ redirect ไป Beam แล้ว ไม่ถึงหน้านี้
  // (createPaymentLink ใน checkout จะส่งไป Beam URL)
  // หน้านี้แสดงเฉพาะ stub mode
  if (isBeamConfigured()) {
    return (
      <main className="mx-auto max-w-md p-6">
        <Card>
          <CardHeader>
            <CardTitle>กำลัง redirect ไป Beam...</CardTitle>
            <CardDescription>
              ถ้าไม่ redirect ภายใน 5 วินาที กรุณาติดต่อร้าน
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>ชำระเงิน (DEV stub)</CardTitle>
          <CardDescription>
            Order #{order.orderNumber} · ยอดรวม{' '}
            <span className="font-mono">฿{fmtBaht(order.totalPrice)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg border bg-yellow-50 p-3 text-xs text-yellow-700">
            ⚠ ยังไม่ได้ตั้ง <code className="font-mono">BEAM_API_KEY</code> — ใช้ stub mode
            สำหรับ test flow. กดปุ่มด้านล่างเพื่อ simulate การชำระเงินสำเร็จ
          </p>
          <form action={simulatePayment.bind(null, order.id, token)}>
            <Button type="submit" className="w-full" size="lg">
              ✓ Simulate payment success
            </Button>
          </form>
          <Link
            href={`/orders/${orderNumber}?token=${token}`}
            className="block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            ยกเลิก กลับไปดู order
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
