import { and, desc, eq } from '@pipecommerce/db'
import {
  customerGroupMembers,
  customerGroups,
  customerLoyalty,
  customers,
  orders,
} from '@pipecommerce/db/schema'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { CustomerGroupAssign } from './group-assign.tsx'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; customerId: string }>
}) {
  const { shopSlug, customerId } = await params
  const { shop } = await requireShop(shopSlug)

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.shopId, shop.id)))
    .limit(1)
  if (!customer) notFound()

  const [memberships, allGroups, customerOrders, loyalty] = await Promise.all([
    db
      .select({
        groupId: customerGroupMembers.groupId,
        groupName: customerGroups.name,
        addedAt: customerGroupMembers.addedAt,
        addedBy: customerGroupMembers.addedBy,
      })
      .from(customerGroupMembers)
      .innerJoin(customerGroups, eq(customerGroups.id, customerGroupMembers.groupId))
      .where(
        and(
          eq(customerGroupMembers.customerId, customerId),
          eq(customerGroupMembers.shopId, shop.id),
        ),
      ),
    db
      .select({ id: customerGroups.id, name: customerGroups.name })
      .from(customerGroups)
      .where(eq(customerGroups.shopId, shop.id)),
    customer.email
      ? db
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            totalPrice: orders.totalPrice,
            financialStatus: orders.financialStatus,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .where(and(eq(orders.shopId, shop.id), eq(orders.email, customer.email)))
          .orderBy(desc(orders.createdAt))
          .limit(20)
      : [],
    db
      .select({
        pointsBalance: customerLoyalty.pointsBalance,
        pointsLifetime: customerLoyalty.pointsLifetime,
      })
      .from(customerLoyalty)
      .where(eq(customerLoyalty.customerId, customerId))
      .limit(1),
  ])
  const loyaltyRow = loyalty[0]

  const memberGroupIds = new Set(memberships.map((m) => m.groupId))
  const availableGroups = allGroups.filter((g) => !memberGroupIds.has(g.id))

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ')

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${shopSlug}/customers`} className="hover:underline">
          ← Customers
        </Link>
      </div>

      <header className="space-y-1">
        <h2 className="text-2xl font-bold">{name || customer.email || 'Customer'}</h2>
        <p className="text-sm text-muted-foreground">
          {customer.email}
          {customer.phone ? ` · ${customer.phone}` : ''}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Orders</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {customer.ordersCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total spent</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {shop.currency}{' '}
              {Number(customer.totalSpent).toLocaleString('th-TH')}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Loyalty points</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {loyaltyRow?.pointsBalance ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Joined</CardDescription>
            <CardTitle className="text-base">
              {new Date(customer.createdAt).toLocaleDateString('th-TH', {
                dateStyle: 'medium',
              })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">คำสั่งซื้อ</CardTitle>
          </CardHeader>
          <CardContent>
            {customerOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มี order</p>
            ) : (
              <ul className="divide-y">
                {customerOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <Link
                        href={`/${shopSlug}/orders/${o.id}`}
                        className="font-mono font-medium hover:underline"
                      >
                        #{o.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString('th-TH', {
                          dateStyle: 'short',
                        })}{' '}
                        · {o.financialStatus}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums">
                      {shop.currency}{' '}
                      {Number(o.totalPrice).toLocaleString('th-TH')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerGroupAssign
              shopSlug={shopSlug}
              customerId={customerId}
              memberships={memberships}
              availableGroups={availableGroups}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
