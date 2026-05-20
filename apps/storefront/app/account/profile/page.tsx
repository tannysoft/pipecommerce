import { and, eq } from '@pipecommerce/db'
import { customers } from '@pipecommerce/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@pipecommerce/ui'
import { db } from '@/lib/db.ts'
import { requireCustomer } from '@/lib/customer-session.ts'
import { ProfileForm } from './profile-form.tsx'

export const metadata = { title: 'ข้อมูลของฉัน' }

export default async function ProfilePage() {
  const customer = await requireCustomer()

  const [row] = await db
    .select({
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
      email: customers.email,
    })
    .from(customers)
    .where(and(eq(customers.id, customer.customerId)))
    .limit(1)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ข้อมูลของฉัน</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลส่วนตัว</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              firstName: row?.firstName ?? null,
              lastName: row?.lastName ?? null,
              phone: row?.phone ?? null,
              email: row?.email ?? customer.email,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
