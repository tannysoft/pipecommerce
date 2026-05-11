import { desc, eq } from '@pipecommerce/db'
import { discounts } from '@pipecommerce/db/schema'
import {
  Button,
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

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  disabled: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-800',
  expired: 'bg-yellow-100 text-yellow-800',
}

const TYPE_LABEL: Record<string, string> = {
  percentage: '% off',
  fixed_amount: 'จำนวนเงิน',
  free_shipping: 'ส่งฟรี',
  bxgy: 'BxGy',
}

export default async function DiscountsListPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const list = await db
    .select({
      id: discounts.id,
      code: discounts.code,
      title: discounts.title,
      type: discounts.type,
      value: discounts.value,
      status: discounts.status,
      usedCount: discounts.usedCount,
      usageLimit: discounts.usageLimit,
      endsAt: discounts.endsAt,
    })
    .from(discounts)
    .where(eq(discounts.shopId, shop.id))
    .orderBy(desc(discounts.createdAt))
    .limit(100)

  if (list.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Discounts</CardTitle>
          <CardDescription>
            สร้าง discount code หรือ automatic discount — ตอนนี้ยังไม่มี
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/${shopSlug}/discounts/new`}>
            <Button>+ สร้าง Discount</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Discounts</h2>
        <Link href={`/${shopSlug}/discounts/new`}>
          <Button>+ สร้าง Discount</Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Used</TableHead>
              <TableHead>หมดอายุ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Link
                    href={`/${shopSlug}/discounts/${d.id}`}
                    className="font-mono font-medium hover:underline"
                  >
                    {d.code ?? <span className="text-muted-foreground">auto</span>}
                  </Link>
                </TableCell>
                <TableCell>{d.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {TYPE_LABEL[d.type] ?? d.type}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {d.type === 'percentage'
                    ? `${d.value ?? 0}%`
                    : d.type === 'fixed_amount'
                      ? `${shop.currency} ${d.value ?? 0}`
                      : '—'}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[d.status] ?? STATUS_BADGE.disabled}`}
                  >
                    {d.status}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {d.usedCount}
                  {d.usageLimit ? ` / ${d.usageLimit}` : ''}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {d.endsAt ? new Date(d.endsAt).toLocaleDateString('th-TH') : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
