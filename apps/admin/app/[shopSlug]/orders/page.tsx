import { and, desc, eq, ilike, or, sql } from '@pipecommerce/db'
import { orders } from '@pipecommerce/db/schema'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
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

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending payment' },
  { key: 'paid', label: 'Paid' },
  { key: 'unfulfilled', label: 'Ready to ship' },
  { key: 'fulfilled', label: 'Fulfilled' },
  { key: 'cancelled', label: 'Cancelled' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

export default async function OrdersListPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  const { shopSlug } = await params
  const { filter: rawFilter, q: rawQ } = await searchParams
  const filter: FilterKey = (FILTERS.find((f) => f.key === rawFilter)?.key ?? 'all') as FilterKey
  const q = (rawQ ?? '').trim()
  const { shop } = await requireShop(shopSlug)

  const conditions = [eq(orders.shopId, shop.id)]
  if (filter === 'pending') conditions.push(eq(orders.financialStatus, 'pending'))
  if (filter === 'paid') conditions.push(eq(orders.financialStatus, 'paid'))
  if (filter === 'unfulfilled') {
    conditions.push(eq(orders.financialStatus, 'paid'))
    conditions.push(eq(orders.fulfillmentStatus, 'unfulfilled'))
  }
  if (filter === 'fulfilled') conditions.push(eq(orders.fulfillmentStatus, 'fulfilled'))
  if (filter === 'cancelled') conditions.push(eq(orders.status, 'cancelled'))
  if (q) {
    const like = `%${q}%`
    const search = or(ilike(orders.orderNumber, like), ilike(orders.email, like))
    if (search) conditions.push(search)
  }

  const list = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      email: orders.email,
      currency: orders.currency,
      totalPrice: orders.totalPrice,
      financialStatus: orders.financialStatus,
      fulfillmentStatus: orders.fulfillmentStatus,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(100)

  const [pendingCountRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.shopId, shop.id), eq(orders.financialStatus, 'pending')))
  const pendingCount = pendingCountRow?.c ?? 0

  if (list.length === 0 && filter === 'all') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>ยังไม่มี order — รอลูกค้าสั่งซื้อจาก storefront</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`https://${shop.slug}.pipecommerce.local`}
            className="text-sm text-primary hover:underline"
          >
            เปิด storefront →
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Orders</h2>
          {pendingCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              {pendingCount} order รอการชำระเงิน
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b text-sm">
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => {
            const active = f.key === filter
            const params = new URLSearchParams()
            if (f.key !== 'all') params.set('filter', f.key)
            if (q) params.set('q', q)
            const qs = params.toString()
            const href = qs
              ? `/${shopSlug}/orders?${qs}`
              : `/${shopSlug}/orders`
            return (
              <Link
                key={f.key}
                href={href}
                className={`-mb-px border-b-2 px-3 py-2 transition-colors ${
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>

        <form className="flex items-center gap-2 pb-2">
          {filter !== 'all' ? (
            <input type="hidden" name="filter" value={filter} />
          ) : null}
          <Input
            type="search"
            name="q"
            placeholder="ค้นหา order # หรือ email"
            defaultValue={q}
            className="h-8 w-56"
          />
          <Button type="submit" size="sm" variant="outline">
            ค้นหา
          </Button>
          {q ? (
            <Link
              href={
                filter === 'all'
                  ? `/${shopSlug}/orders`
                  : `/${shopSlug}/orders?filter=${filter}`
              }
              className="text-xs text-muted-foreground hover:underline"
            >
              ล้าง
            </Link>
          ) : null}
        </form>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            ไม่มี order ที่ตรงกับ filter นี้
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Fulfillment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      href={`/${shopSlug}/orders/${o.id}`}
                      className="font-mono font-medium hover:underline"
                    >
                      #{o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.email ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString('th-TH', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge map={FINANCIAL_BADGE} value={o.financialStatus} />
                  </TableCell>
                  <TableCell>
                    <Badge map={FULFILLMENT_BADGE} value={o.fulfillmentStatus} />
                  </TableCell>
                  <TableCell>
                    <Badge map={STATUS_BADGE} value={o.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.currency} {Number(o.totalPrice).toLocaleString('th-TH')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function Badge({ map, value }: { map: Record<string, string>; value: string }) {
  const cls = map[value] ?? 'bg-gray-100 text-gray-700'
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{value}</span>
}
