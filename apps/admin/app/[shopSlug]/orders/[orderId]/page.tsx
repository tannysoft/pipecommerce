import { and, eq } from '@pipecommerce/db'
import { orderLineItems, orders } from '@pipecommerce/db/schema'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { OrderStatusActions } from './order-actions.tsx'

const FINANCIAL_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  partially_refunded: 'bg-orange-100 text-orange-800',
  refunded: 'bg-gray-200 text-gray-800',
  voided: 'bg-gray-200 text-gray-700',
}
const FULFILLMENT_BADGE: Record<string, string> = {
  unfulfilled: 'bg-gray-100 text-gray-700',
  partial: 'bg-blue-100 text-blue-800',
  fulfilled: 'bg-green-100 text-green-800',
}
const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-800',
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

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; orderId: string }>
}) {
  const { shopSlug, orderId } = await params
  const { shop } = await requireShop(shopSlug)

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.shopId, shop.id)))
    .limit(1)
  if (!order) notFound()

  const lineItems = await db
    .select({
      id: orderLineItems.id,
      productTitle: orderLineItems.productTitle,
      variantTitle: orderLineItems.variantTitle,
      sku: orderLineItems.sku,
      quantity: orderLineItems.quantity,
      price: orderLineItems.price,
      totalDiscount: orderLineItems.totalDiscount,
    })
    .from(orderLineItems)
    .where(eq(orderLineItems.orderId, orderId))

  const shippingAddr = order.shippingAddress as Address
  const phone = order.phone

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${shopSlug}/orders`} className="hover:underline">
          ← Orders
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-2xl font-bold">#{order.orderNumber}</h2>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString('th-TH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge map={FINANCIAL_BADGE} value={order.financialStatus} />
          <Badge map={FULFILLMENT_BADGE} value={order.fulfillmentStatus} />
          <Badge map={STATUS_BADGE} value={order.status} />
        </div>
      </div>

      <OrderStatusActions
        shopSlug={shopSlug}
        orderId={order.id}
        financialStatus={order.financialStatus}
        fulfillmentStatus={order.fulfillmentStatus}
        status={order.status}
        totalPrice={order.totalPrice}
        currency={order.currency}
      />

      {order.status === 'cancelled' ? (
        <Card>
          <CardContent className="py-3 text-sm">
            <p className="font-medium text-destructive">ยกเลิกแล้ว</p>
            {order.cancelReason ? (
              <p className="text-muted-foreground">เหตุผล: {order.cancelReason}</p>
            ) : null}
            {order.cancelledAt ? (
              <p className="text-xs text-muted-foreground">
                เมื่อ{' '}
                {new Date(order.cancelledAt).toLocaleString('th-TH', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">รายการสินค้า ({lineItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lineItems.map((line) => {
              const lineTotal =
                Number(line.price) * line.quantity - Number(line.totalDiscount)
              return (
                <div key={line.id} className="flex justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{line.productTitle}</p>
                    {line.variantTitle ? (
                      <p className="text-xs text-muted-foreground">
                        {line.variantTitle}
                      </p>
                    ) : null}
                    {line.sku ? (
                      <p className="font-mono text-xs text-muted-foreground">
                        SKU: {line.sku}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {line.quantity} × {order.currency}{' '}
                      {Number(line.price).toLocaleString('th-TH')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    {order.currency} {lineTotal.toLocaleString('th-TH')}
                  </div>
                </div>
              )
            })}

            <Separator />

            <div className="space-y-1 text-sm">
              <SummaryLine label="Subtotal" currency={order.currency} value={order.subtotalPrice} />
              {Number(order.totalDiscounts) > 0 ? (
                <SummaryLine
                  label="Discounts"
                  currency={order.currency}
                  value={`-${order.totalDiscounts}`}
                />
              ) : null}
              <SummaryLine
                label="Shipping"
                currency={order.currency}
                value={order.totalShipping}
              />
              <SummaryLine label="Tax" currency={order.currency} value={order.totalTax} />
              {order.loyaltyPointsRedeemed > 0 ? (
                <SummaryLine
                  label={`Loyalty (${order.loyaltyPointsRedeemed} points)`}
                  currency={order.currency}
                  value={`-${order.loyaltyAmountRedeemed}`}
                />
              ) : null}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {order.currency} {Number(order.totalPrice).toLocaleString('th-TH')}
                </span>
              </div>
              {order.loyaltyPointsEarned > 0 ? (
                <p className="text-xs text-muted-foreground">
                  ลูกค้าได้รับ {order.loyaltyPointsEarned} loyalty points
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ลูกค้า</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>{order.email ?? '—'}</p>
              {phone ? <p className="text-muted-foreground">{phone}</p> : null}
              {order.customerId ? (
                <p className="text-xs text-muted-foreground">
                  Customer ID:{' '}
                  <span className="font-mono">{order.customerId.slice(0, 8)}…</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Guest checkout</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">ที่อยู่จัดส่ง</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {shippingAddr ? (
                <address className="not-italic space-y-0.5">
                  <p>
                    {[shippingAddr.firstName, shippingAddr.lastName]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </p>
                  <p>{shippingAddr.address1}</p>
                  {shippingAddr.address2 ? <p>{shippingAddr.address2}</p> : null}
                  <p>
                    {[shippingAddr.city, shippingAddr.province, shippingAddr.postalCode]
                      .filter(Boolean)
                      .join(' ')}
                  </p>
                  <p className="text-muted-foreground">{shippingAddr.country}</p>
                </address>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Badge({ map, value }: { map: Record<string, string>; value: string }) {
  const cls = map[value] ?? 'bg-gray-100 text-gray-700'
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{value}</span>
}

function SummaryLine({
  label,
  currency,
  value,
}: {
  label: string
  currency: string
  value: string | number
}) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">
        {currency} {Number(value).toLocaleString('th-TH')}
      </span>
    </div>
  )
}
