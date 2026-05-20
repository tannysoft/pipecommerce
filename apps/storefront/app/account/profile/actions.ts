'use server'

import { eq } from '@pipecommerce/db'
import { customers } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { requireCustomer } from '@/lib/customer-session.ts'

const PHONE_RE = /^[0-9+\-() ]{6,20}$/

export type SaveProfileResult = { ok: true } | { ok: false; error: string }

export async function saveCustomerProfile(
  formData: FormData,
): Promise<SaveProfileResult> {
  const customer = await requireCustomer()

  const firstName = String(formData.get('firstName') ?? '').trim() || null
  const lastName = String(formData.get('lastName') ?? '').trim() || null
  const phoneRaw = String(formData.get('phone') ?? '').trim()
  const phone = phoneRaw === '' ? null : phoneRaw

  if (firstName && firstName.length > 80) {
    return { ok: false, error: 'ชื่อยาวเกินไป' }
  }
  if (lastName && lastName.length > 80) {
    return { ok: false, error: 'นามสกุลยาวเกินไป' }
  }
  if (phone && !PHONE_RE.test(phone)) {
    return { ok: false, error: 'รูปแบบเบอร์โทรไม่ถูกต้อง' }
  }

  await db
    .update(customers)
    .set({ firstName, lastName, phone, updatedAt: new Date() })
    .where(eq(customers.id, customer.customerId))

  revalidatePath('/account')
  revalidatePath('/account/profile')
  return { ok: true }
}
