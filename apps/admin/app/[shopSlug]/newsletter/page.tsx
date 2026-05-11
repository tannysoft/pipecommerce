import { and, desc, eq, sql } from '@pipecommerce/db'
import { newsletterSubscribers } from '@pipecommerce/db/schema'
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
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

const STATUS_BADGE: Record<string, string> = {
  subscribed: 'bg-green-100 text-green-800',
  unsubscribed: 'bg-gray-100 text-gray-700',
  bounced: 'bg-red-100 text-red-800',
}

const STATUS_LABEL: Record<string, string> = {
  subscribed: 'รับข่าวสาร',
  unsubscribed: 'ยกเลิกแล้ว',
  bounced: 'ส่งไม่ถึง',
}

export default async function NewsletterListPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const [list, statsRow] = await Promise.all([
    db
      .select({
        id: newsletterSubscribers.id,
        email: newsletterSubscribers.email,
        status: newsletterSubscribers.status,
        source: newsletterSubscribers.source,
        subscribedAt: newsletterSubscribers.subscribedAt,
      })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.shopId, shop.id))
      .orderBy(desc(newsletterSubscribers.subscribedAt))
      .limit(200),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(newsletterSubscribers)
      .where(
        and(
          eq(newsletterSubscribers.shopId, shop.id),
          eq(newsletterSubscribers.status, 'subscribed'),
        ),
      ),
  ])
  const subscribedCount = statsRow[0]?.c ?? 0

  if (list.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Newsletter</CardTitle>
          <CardDescription>
            ลูกค้าที่สมัครรับข่าวสารจาก storefront — ยังไม่มี subscriber
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            ฟอร์มสมัครจะแสดงใน storefront footer อัตโนมัติ
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Newsletter Subscribers</h2>
        <p className="text-sm text-muted-foreground">
          {subscribedCount} active · {list.length} total
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subscribed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.email}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.source}</TableCell>
                <TableCell>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[s.status] ?? STATUS_BADGE.subscribed}`}
                  >
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(s.subscribedAt).toLocaleString('th-TH', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
