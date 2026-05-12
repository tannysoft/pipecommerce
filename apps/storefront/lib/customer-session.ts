import { and, eq } from '@pipecommerce/db'
import { customers } from '@pipecommerce/db/schema'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { customerCookieOptions, readSessionToken } from './customer-auth.ts'
import { db } from './db.ts'
import { requireShopFromHost } from './shop.ts'

export type CustomerSession = {
  customerId: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

/**
 * อ่าน customer จาก cookie + verify HMAC + cross-check shop จาก host
 * คืน null ถ้าไม่ login หรือ token หมดอายุ
 */
export async function getCustomer(): Promise<CustomerSession | null> {
  const shop = await requireShopFromHost()
  const store = await cookies()
  const raw = store.get(customerCookieOptions.name)?.value
  if (!raw) return null

  const payload = await readSessionToken(raw)
  if (!payload) return null
  if (payload.shopId !== shop.id) return null

  const [c] = await db
    .select({
      id: customers.id,
      email: customers.email,
      firstName: customers.firstName,
      lastName: customers.lastName,
      avatarUrl: customers.avatarUrl,
    })
    .from(customers)
    .where(and(eq(customers.id, payload.customerId), eq(customers.shopId, shop.id)))
    .limit(1)
  if (!c) return null

  return {
    customerId: c.id,
    email: c.email ?? payload.email,
    firstName: c.firstName,
    lastName: c.lastName,
    avatarUrl: c.avatarUrl,
  }
}

export async function requireCustomer(): Promise<CustomerSession> {
  const c = await getCustomer()
  if (!c) redirect('/account/login')
  return c
}
