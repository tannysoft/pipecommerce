import { desc, eq } from '@pipecommerce/db'
import { customerAddresses } from '@pipecommerce/db/schema'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import { db } from '@/lib/db.ts'
import { requireCustomer } from '@/lib/customer-session.ts'
import { AddressesList } from './addresses-list.tsx'

export const metadata = { title: 'ที่อยู่จัดส่ง' }

export default async function AddressesPage() {
  const customer = await requireCustomer()

  const rows = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customer.customerId))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ที่อยู่จัดส่ง</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ที่อยู่ของฉัน</CardTitle>
          <CardDescription>
            ที่อยู่หลักจะถูกเลือกอัตโนมัติตอน checkout
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddressesList
            addresses={rows.map((r) => ({
              id: r.id,
              label: r.label,
              recipientName: r.recipientName,
              phone: r.phone,
              line1: r.line1,
              line2: r.line2,
              subdistrict: r.subdistrict,
              district: r.district,
              province: r.province,
              postalCode: r.postalCode,
              isDefault: r.isDefault,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
