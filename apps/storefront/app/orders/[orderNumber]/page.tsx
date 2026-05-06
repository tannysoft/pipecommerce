import { and, asc, eq } from '@pipecommerce/db'
import { orderLineItems, orders } from '@pipecommerce/db/schema'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

const fmtBaht = (raw: string | number) =>
  Number(raw).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_LABEL_TH: Record<string, string> = {
  pending: 'รอชำระเงิน',
  paid: 'ชำระแล้ว',
  partially_refunded: 'คืนเงินบางส่วน',
  refunded: 'คืนเงินเต็มจำนวน',
  voided: 'ยกเลิก',
  unfulfilled: 'รอจัดส่ง',
  partial: 'จัดส่งบางส่วน',
  fulfilled: 'จัดส่งแล้ว',
}

export default async function OrderTrackingPage({
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

  const lines = await db
    .select()
    .from(orderLineItems)
    .where(eq(orderLineItems.orderId, order.id))
    .orderBy(asc(orderLineItems.id))

  const addr = order.shippingAddress as
    | {
        firstName?: string
        lastName?: string
        address1?: string
        address2?: string
        city?: string
        province?: string
        postalCode?: string
        country?: string
        phone?: string
      }
    | null

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← {shop.name}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-3xl font-bold">Order #{order.orderNumber}</h1>
          <span className="rounded-full border bg-yellow-50 px-3 py-1 text-xs text-yellow-700">
            {STATUS_LABEL_TH[order.financialStatus] ?? order.financialStatus}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          สั่งซื้อเมื่อ{' '}
          {new Date(order.createdAt).toLocaleString('th-TH', {
            dateStyle: 'long',
            timeStyle: 'short',
          })}
        </p>
      </header>

      {order.financialStatus === 'pending' ? (
        <Card>
          <CardHeader>
            <CardTitle>รอชำระเงิน</CardTitle>
            <CardDescription>
              ระบบ payment (Beam) ยังไม่ได้ผูก — เจ้าของร้านจะติดต่อกลับเพื่อแจ้งช่องทางชำระ
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>รายการสินค้า</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lines.map((l) => (
            <div key={l.id} className="flex justify-between gap-3 border-b py-2 last:border-b-0">
              <div className="flex-1">
                <p className="font-medium">{l.productTitle}</p>
                {l.variantTitle && l.variantTitle !== 'Default Title' ? (
                  <p className="text-xs text-muted-foreground">{l.variantTitle}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  ฿{fmtBaht(l.price)} × {l.quantity}
                </p>
              </div>
              <p className="font-mono">฿{fmtBaht(Number(l.price) * l.quantity)}</p>
            </div>
          ))}
          <dl className="space-y-1 pt-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-mono">฿{fmtBaht(order.subtotalPrice)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">ค่าส่ง</dt>
              <dd className="font-mono">฿{fmtBaht(order.totalShipping)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">VAT</dt>
              <dd className="font-mono">฿{fmtBaht(order.totalTax)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base">
              <dt className="font-medium">Total</dt>
              <dd className="font-mono font-semibold">฿{fmtBaht(order.totalPrice)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {addr ? (
        <Card>
          <CardHeader>
            <CardTitle>ที่อยู่จัดส่ง</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              {addr.firstName} {addr.lastName}
            </p>
            <p>{addr.address1}</p>
            {addr.address2 ? <p>{addr.address2}</p> : null}
            <p>
              {addr.city} {addr.province} {addr.postalCode}
            </p>
            {addr.phone ? <p className="text-muted-foreground">โทร {addr.phone}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        เก็บลิงก์นี้ไว้เพื่อดูสถานะ — แชร์ไม่ได้ให้ใครเพราะมี token ใน URL
      </p>
    </main>
  )
}
