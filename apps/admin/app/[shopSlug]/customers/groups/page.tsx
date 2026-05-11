import { desc, eq, sql } from '@pipecommerce/db'
import { customerGroupMembers, customerGroups } from '@pipecommerce/db/schema'
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
import { GroupsManager } from './groups-manager.tsx'

export default async function CustomerGroupsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const groups = await db
    .select({
      id: customerGroups.id,
      name: customerGroups.name,
      description: customerGroups.description,
      type: customerGroups.type,
      memberCount: sql<number>`count(${customerGroupMembers.customerId})::int`,
    })
    .from(customerGroups)
    .leftJoin(customerGroupMembers, eq(customerGroupMembers.groupId, customerGroups.id))
    .where(eq(customerGroups.shopId, shop.id))
    .groupBy(customerGroups.id)
    .orderBy(desc(customerGroups.createdAt))

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${shopSlug}/customers`} className="hover:underline">
          ← Customers
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Groups</CardTitle>
          <CardDescription>
            แบ่งกลุ่มลูกค้า เช่น VIP, Wholesale — ใช้ assign สิทธิ์พิเศษ (perks มาใน P2)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GroupsManager shopSlug={shopSlug} groups={groups} />
        </CardContent>
      </Card>
    </div>
  )
}
