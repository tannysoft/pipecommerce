import { and, desc, eq } from '@pipecommerce/db'
import { orders } from '@pipecommerce/db/schema'
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { requireCustomer } from '@/lib/customer-session.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

export const metadata = { title: 'คำสั่งซื้อของฉัน' }

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

export default async function CustomerOrdersPage() {
  const customer = await requireCustomer()
  const shop = await requireShopFromHost()

  const list = await db
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
    .limit(50)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">คำสั่งซื้อของฉัน</h1>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            ยังไม่มีคำสั่งซื้อ —{' '}
            <Link href="/" className="text-primary hover:underline">
              เริ่มช้อปปิ้ง
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>วันที่</TableHead>
                <TableHead>การชำระ</TableHead>
                <TableHead>การจัดส่ง</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      href={`/account/orders/${o.orderNumber}`}
                      className="font-mono font-medium hover:underline"
                    >
                      #{o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString('th-TH', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                  <TableCell className="text-xs">
                    {FINANCIAL_LABEL[o.financialStatus] ?? o.financialStatus}
                  </TableCell>
                  <TableCell className="text-xs">
                    {FULFILLMENT_LABEL[o.fulfillmentStatus] ?? o.fulfillmentStatus}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {shop.currency}{' '}
                    {Number(o.totalPrice).toLocaleString('th-TH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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
