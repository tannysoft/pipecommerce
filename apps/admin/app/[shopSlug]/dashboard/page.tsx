import { and, count, desc, eq, gte, lte, ne, sql } from '@pipecommerce/db'
import { customers, orderLineItems, orders } from '@pipecommerce/db/schema'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

const fmtMoney = (currency: string, raw: number | string) =>
  `${currency} ${Number(raw).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const now = new Date()
  const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const start60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const baseFilter = and(eq(orders.shopId, shop.id), ne(orders.status, 'cancelled'))

  const paidWindow = (from: Date, to?: Date) =>
    to
      ? and(
          baseFilter,
          eq(orders.financialStatus, 'paid'),
          gte(orders.createdAt, from),
          lte(orders.createdAt, to),
        )
      : and(baseFilter, eq(orders.financialStatus, 'paid'), gte(orders.createdAt, from))

  const [
    revenue30,
    revenuePrev30,
    revenue7,
    ordersPending,
    topProducts30,
    recentOrders,
    customerCount,
  ] = await Promise.all([
    db
      .select({
        revenue: sql<string>`coalesce(sum(${orders.totalPrice}), 0)`,
        count: count(),
      })
      .from(orders)
      .where(paidWindow(start30)),
    db
      .select({ revenue: sql<string>`coalesce(sum(${orders.totalPrice}), 0)` })
      .from(orders)
      .where(paidWindow(start60, start30)),
    db
      .select({ count: count() })
      .from(orders)
      .where(paidWindow(start7)),
    db
      .select({ c: count() })
      .from(orders)
      .where(and(eq(orders.shopId, shop.id), eq(orders.financialStatus, 'pending'))),
    db
      .select({
        productTitle: orderLineItems.productTitle,
        units: sql<string>`sum(${orderLineItems.quantity})`,
      })
      .from(orderLineItems)
      .innerJoin(orders, eq(orders.id, orderLineItems.orderId))
      .where(
        and(
          eq(orderLineItems.shopId, shop.id),
          eq(orders.financialStatus, 'paid'),
          ne(orders.status, 'cancelled'),
          gte(orders.createdAt, start30),
        ),
      )
      .groupBy(orderLineItems.productTitle)
      .orderBy(sql`sum(${orderLineItems.quantity}) desc`)
      .limit(5),
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        email: orders.email,
        totalPrice: orders.totalPrice,
        financialStatus: orders.financialStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.shopId, shop.id))
      .orderBy(desc(orders.createdAt))
      .limit(10),
    db
      .select({ c: count() })
      .from(customers)
      .where(eq(customers.shopId, shop.id)),
  ])

  const rev30 = Number(revenue30[0]?.revenue ?? 0)
  const revPrev = Number(revenuePrev30[0]?.revenue ?? 0)
  const orders30 = revenue30[0]?.count ?? 0
  const orders7 = revenue7[0]?.count ?? 0
  const aov30 = orders30 > 0 ? rev30 / orders30 : 0
  const trend = revPrev > 0 ? ((rev30 - revPrev) / revPrev) * 100 : null

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>รายได้ 30 วัน</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {fmtMoney(shop.currency, rev30)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {trend !== null ? (
              <span className={trend >= 0 ? 'text-green-600' : 'text-destructive'}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% เทียบกับ 30 วันก่อน
              </span>
            ) : (
              <span>ยังไม่มีข้อมูลย้อนหลัง</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Orders 30 วัน</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{orders30}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {orders7} order ใน 7 วันล่าสุด
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>AOV (Avg Order Value)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {fmtMoney(shop.currency, aov30)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">เฉลี่ย 30 วัน</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pending payment</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {ordersPending[0]?.c ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <Link
              href={`/${shopSlug}/orders?filter=pending`}
              className="text-primary hover:underline"
            >
              ดูทั้งหมด →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent orders</CardTitle>
            <Link
              href={`/${shopSlug}/orders`}
              className="text-sm text-primary hover:underline"
            >
              ดูทั้งหมด →
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มี order</p>
            ) : (
              <ul className="divide-y">
                {recentOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <Link
                        href={`/${shopSlug}/orders/${o.id}`}
                        className="font-mono font-medium hover:underline"
                      >
                        #{o.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {o.email ?? 'guest'} ·{' '}
                        {new Date(o.createdAt).toLocaleDateString('th-TH', {
                          dateStyle: 'short',
                        })}{' '}
                        · {o.financialStatus}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums">
                      {fmtMoney(shop.currency, o.totalPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top products (30 วัน)</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts30.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มียอดขาย</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {topProducts30.map((p, idx) => (
                  <li key={p.productTitle} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {idx + 1}. {p.productTitle}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                      {p.units} ชิ้น
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Customers ทั้งหมด</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {customerCount[0]?.c ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <Link
              href={`/${shopSlug}/customers`}
              className="text-primary hover:underline"
            >
              ดูรายการ →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Storefront</CardDescription>
            <CardTitle className="text-base">{shop.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <span className="font-mono">/{shop.slug}</span>
            {shop.status === 'trial' ? <span className="ml-2">· trial</span> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
