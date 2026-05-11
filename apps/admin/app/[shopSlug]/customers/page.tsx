import { desc, eq, sql } from '@pipecommerce/db'
import { customerGroupMembers, customerGroups, customers } from '@pipecommerce/db/schema'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

export default async function CustomersListPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const list = await db
    .select({
      id: customers.id,
      email: customers.email,
      firstName: customers.firstName,
      lastName: customers.lastName,
      ordersCount: customers.ordersCount,
      totalSpent: customers.totalSpent,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(eq(customers.shopId, shop.id))
    .orderBy(desc(customers.createdAt))
    .limit(100)

  // Load group memberships for all listed customers
  const customerIds = list.map((c) => c.id)
  const memberships =
    customerIds.length > 0
      ? await db
          .select({
            customerId: customerGroupMembers.customerId,
            groupName: customerGroups.name,
          })
          .from(customerGroupMembers)
          .innerJoin(
            customerGroups,
            eq(customerGroups.id, customerGroupMembers.groupId),
          )
          .where(eq(customerGroupMembers.shopId, shop.id))
      : []
  const groupsByCustomer = new Map<string, string[]>()
  for (const m of memberships) {
    const arr = groupsByCustomer.get(m.customerId) ?? []
    arr.push(m.groupName)
    groupsByCustomer.set(m.customerId, arr)
  }

  if (list.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            ลูกค้าจะปรากฏที่นี่เมื่อมีการสั่งซื้อหรือล็อกอินผ่าน /account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/${shopSlug}/customers/groups`}
            className="text-sm text-primary hover:underline"
          >
            จัดการ Customer Groups →
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Customers</h2>
        <Link
          href={`/${shopSlug}/customers/groups`}
          className="text-sm text-primary hover:underline"
        >
          จัดการ Groups →
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Groups</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((c) => {
              const groups = groupsByCustomer.get(c.id) ?? []
              const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/${shopSlug}/customers/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {name || c.email || '—'}
                    </Link>
                    {name && c.email ? (
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {groups.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        groups.map((g) => (
                          <span
                            key={g}
                            className="rounded bg-muted px-2 py-0.5 text-xs"
                          >
                            {g}
                          </span>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.ordersCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {shop.currency}{' '}
                    {Number(c.totalSpent).toLocaleString('th-TH')}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString('th-TH', {
                      dateStyle: 'short',
                    })}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
