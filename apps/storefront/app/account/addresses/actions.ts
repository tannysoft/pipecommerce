'use server'

import { and, eq } from '@pipecommerce/db'
import { customerAddresses } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { requireCustomer } from '@/lib/customer-session.ts'
import { requireShopFromHost } from '@/lib/shop.ts'

const PHONE_RE = /^[0-9+\-() ]{6,20}$/
const POSTAL_RE = /^[0-9]{4,10}$/

export type SaveAddressResult =
  | { ok: true; addressId: string }
  | { ok: false; error: string }

type AddressValues = {
  recipientName: string
  phone: string | null
  line1: string
  line2: string | null
  subdistrict: string | null
  district: string | null
  province: string
  postalCode: string
  label: string | null
  isDefault: boolean
}

function validate(
  formData: FormData,
): { ok: true; values: AddressValues } | { ok: false; error: string } {
  const get = (k: string) => String(formData.get(k) ?? '').trim()
  const recipientName = get('recipientName')
  const phone = get('phone')
  const line1 = get('line1')
  const line2 = get('line2') || null
  const subdistrict = get('subdistrict') || null
  const district = get('district') || null
  const province = get('province')
  const postalCode = get('postalCode')
  const label = get('label') || null
  const isDefault = formData.get('isDefault') === 'on' || formData.get('isDefault') === 'true'

  if (!recipientName) return { ok: false, error: 'กรุณากรอกชื่อผู้รับ' }
  if (!line1) return { ok: false, error: 'กรุณากรอกที่อยู่' }
  if (!province) return { ok: false, error: 'กรุณากรอกจังหวัด' }
  if (!postalCode || !POSTAL_RE.test(postalCode)) {
    return { ok: false, error: 'รหัสไปรษณีย์ไม่ถูกต้อง' }
  }
  if (phone && !PHONE_RE.test(phone)) {
    return { ok: false, error: 'รูปแบบเบอร์โทรไม่ถูกต้อง' }
  }
  return {
    ok: true,
    values: {
      recipientName,
      phone: phone || null,
      line1,
      line2,
      subdistrict,
      district,
      province,
      postalCode,
      label,
      isDefault,
    },
  }
}

export async function createAddress(formData: FormData): Promise<SaveAddressResult> {
  const customer = await requireCustomer()
  const shop = await requireShopFromHost()
  const v = validate(formData)
  if (!v.ok) return v

  // ถ้าตั้ง default → clear default เก่าก่อน (partial unique index บังคับ)
  if (v.values.isDefault) {
    await db
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, customer.customerId))
  }

  const [created] = await db
    .insert(customerAddresses)
    .values({
      customerId: customer.customerId,
      shopId: shop.id,
      ...v.values,
    })
    .returning({ id: customerAddresses.id })

  revalidatePath('/account/addresses')
  return { ok: true, addressId: created!.id }
}

export async function updateAddress(
  addressId: string,
  formData: FormData,
): Promise<SaveAddressResult> {
  const customer = await requireCustomer()
  const v = validate(formData)
  if (!v.ok) return v

  if (v.values.isDefault) {
    await db
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, customer.customerId))
  }

  await db
    .update(customerAddresses)
    .set({ ...v.values, updatedAt: new Date() })
    .where(
      and(
        eq(customerAddresses.id, addressId),
        eq(customerAddresses.customerId, customer.customerId),
      ),
    )

  revalidatePath('/account/addresses')
  return { ok: true, addressId }
}

export async function deleteAddress(addressId: string): Promise<{ ok: boolean }> {
  const customer = await requireCustomer()
  await db
    .delete(customerAddresses)
    .where(
      and(
        eq(customerAddresses.id, addressId),
        eq(customerAddresses.customerId, customer.customerId),
      ),
    )
  revalidatePath('/account/addresses')
  return { ok: true }
}
