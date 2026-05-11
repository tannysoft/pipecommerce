import { and, asc, eq } from '@pipecommerce/db'
import { orderLineItems, orders } from '@pipecommerce/db/schema'
import { Card, CardContent, CardHeader, CardTitle, Separator } from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCustomer } from '@/lib/customer-session.ts'
import { db } from '@/lib/db.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

const fmtMoney = (currency: string, raw: string | number) =>
  `${currency} ${Number(raw).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const FINANCIAL_LABEL: Record<string, string> = {
  pending: 'รอชำระ',
  paid: 'ชำระแล้ว',
  partially_refunded: 'คืนเงินบางส่วน',
  refunded: 'คืนเงินแล้ว',
  voided: 'ยกเลิก',
}
const FULFILLMENT_LABEL: Record<string, string> = {
  unfulfilled: 'รอส่ง',
  partial: 'ส่งบางส่วน',
  fulfilled: 'ส่งแล้ว',
}

type Address = {
  firstName?: string
  lastName?: string
  address1?: string
  address2?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
} | null

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  const { orderNumber } = await params
  const customer = await requireCustomer()
  const shop = await requireShopFromHost()

  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.shopId, shop.id),
        eq(orders.orderNumber, orderNumber),
        eq(orders.email, customer.email),
      ),
    )
    .limit(1)
  if (!order) notFound()

  const lines = await db
    .select()
    .from(orderLineItems)
    .where(eq(orderLineItems.orderId, order.id))
    .orderBy(asc(orderLineItems.id))

  const shipping = order.shippingAddress as Address

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href="/account/orders" className="hover:underline">
          ← คำสั่งซื้อทั้งหมด
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold">#{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString('th-TH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          <span className="rounded bg-muted px-2 py-1">
            {FINANCIAL_LABEL[order.financialStatus] ?? order.financialStatus}
          </span>
          <span className="rounded bg-muted px-2 py-1">
            {FULFILLMENT_LABEL[order.fulfillmentStatus] ?? order.fulfillmentStatus}
          </span>
        </div>
      </div>

      {order.financialStatus === 'pending' && order.status !== 'cancelled' ? (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">รอการชำระเงิน</p>
              <p className="text-xs text-muted-foreground">
                คลิกเพื่อชำระเงินผ่านลิงก์ที่ส่งให้ตอนสั่งซื้อ
              </p>
            </div>
            <Link
              href={`/orders/${order.orderNumber}?token=${order.trackingToken}`}
              className="rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90"
            >
              ชำระเงิน
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">รายการสินค้า ({lines.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((line) => {
              const lineTotal =
                Number(line.price) * line.quantity - Number(line.totalDiscount)
              return (
                <div key={line.id} className="flex justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{line.productTitle}</p>
                    {line.variantTitle ? (
                      <p className="text-xs text-muted-foreground">{line.variantTitle}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {line.quantity} × {fmtMoney(order.currency, line.price)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    {fmtMoney(order.currency, lineTotal)}
                  </div>
                </div>
              )
            })}

            <Separator />

            <div className="space-y-1 text-sm">
              <SummaryLine label="Subtotal" value={fmtMoney(order.currency, order.subtotalPrice)} />
              {Number(order.totalDiscounts) > 0 ? (
                <SummaryLine
                  label="ส่วนลด"
                  value={`-${fmtMoney(order.currency, order.totalDiscounts)}`}
                />
              ) : null}
              {Number(order.totalShipping) > 0 ? (
                <SummaryLine
                  label="ค่าส่ง"
                  value={fmtMoney(order.currency, order.totalShipping)}
                />
              ) : null}
              {Number(order.totalTax) > 0 ? (
                <SummaryLine label="ภาษี" value={fmtMoney(order.currency, order.totalTax)} />
              ) : null}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{fmtMoney(order.currency, order.totalPrice)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ที่อยู่จัดส่ง</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {shipping ? (
              <address className="not-italic space-y-0.5">
                <p>
                  {[shipping.firstName, shipping.lastName].filter(Boolean).join(' ') || '—'}
                </p>
                <p>{shipping.address1}</p>
                {shipping.address2 ? <p>{shipping.address2}</p> : null}
                <p>
                  {[shipping.city, shipping.province, shipping.postalCode]
                    .filter(Boolean)
                    .join(' ')}
                </p>
                <p className="text-muted-foreground">{shipping.country}</p>
              </address>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
