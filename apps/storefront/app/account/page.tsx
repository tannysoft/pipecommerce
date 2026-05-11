import { and, desc, eq, sql } from '@pipecommerce/db'
import { customerLoyalty, customers, orders } from '@pipecommerce/db/schema'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { requireCustomer } from '@/lib/customer-session.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

export const metadata = { title: 'บัญชีของฉัน' }

export default async function AccountDashboardPage() {
  const customer = await requireCustomer()
  const shop = await requireShopFromHost()

  // Stats
  const [stats] = await db
    .select({
      ordersCount: customers.ordersCount,
      totalSpent: customers.totalSpent,
    })
    .from(customers)
    .where(eq(customers.id, customer.customerId))
    .limit(1)

  const [loyalty] = await db
    .select({ pointsBalance: customerLoyalty.pointsBalance })
    .from(customerLoyalty)
    .where(eq(customerLoyalty.customerId, customer.customerId))
    .limit(1)

  const [recentOrders, totalCountRow] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        totalPrice: orders.totalPrice,
        financialStatus: orders.financialStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.shopId, shop.id), eq(orders.email, customer.email)))
      .orderBy(desc(orders.createdAt))
      .limit(5),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.shopId, shop.id), eq(orders.email, customer.email))),
  ])
  const totalCount = totalCountRow[0]?.c ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          สวัสดี{customer.firstName ? `, ${customer.firstName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground">{customer.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>คำสั่งซื้อทั้งหมด</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{totalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>ยอดซื้อรวม</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {shop.currency}{' '}
              {Number(stats?.totalSpent ?? 0).toLocaleString('th-TH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>แต้มสะสม</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {loyalty?.pointsBalance ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">คำสั่งซื้อล่าสุด</CardTitle>
          <Link
            href="/account/orders"
            className="text-sm text-primary hover:underline"
          >
            ดูทั้งหมด →
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีคำสั่งซื้อ</p>
          ) : (
            <ul className="divide-y">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <Link
                      href={`/account/orders/${o.orderNumber}`}
                      className="font-mono font-medium hover:underline"
                    >
                      #{o.orderNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString('th-TH', {
                        dateStyle: 'medium',
                      })}{' '}
                      · {o.financialStatus} / {o.fulfillmentStatus}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums">
                    {shop.currency}{' '}
                    {Number(o.totalPrice).toLocaleString('th-TH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
