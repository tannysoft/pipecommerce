'use server'

import { and, eq } from '@pipecommerce/db'
import { discounts } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

export type ActionResult = { ok: true } | { ok: false; error: string }

export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping'
export type DiscountStatus = 'active' | 'disabled' | 'scheduled' | 'expired'

const VALID_TYPES: DiscountType[] = ['percentage', 'fixed_amount', 'free_shipping']

function readForm(formData: FormData) {
  const code = String(formData.get('code') ?? '')
    .trim()
    .toUpperCase() || null
  const title = String(formData.get('title') ?? '').trim()
  const type = String(formData.get('type') ?? '') as DiscountType
  const valueRaw = String(formData.get('value') ?? '').trim()
  const minAmountRaw = String(formData.get('minimumAmount') ?? '').trim()
  const usageLimitRaw = String(formData.get('usageLimit') ?? '').trim()
  const startsAtRaw = String(formData.get('startsAt') ?? '').trim()
  const endsAtRaw = String(formData.get('endsAt') ?? '').trim()
  const status = String(formData.get('status') ?? 'active') as DiscountStatus

  return {
    code,
    title,
    type,
    value: valueRaw,
    minimumAmount: minAmountRaw,
    usageLimit: usageLimitRaw,
    startsAt: startsAtRaw,
    endsAt: endsAtRaw,
    status,
  }
}

function validate(input: ReturnType<typeof readForm>): string | null {
  if (!input.title) return 'กรุณากรอก title'
  if (!VALID_TYPES.includes(input.type)) return 'ประเภทไม่ถูกต้อง'
  if (input.type !== 'free_shipping') {
    const v = Number(input.value)
    if (!Number.isFinite(v) || v < 0) return 'value ต้องเป็นตัวเลข ≥ 0'
    if (input.type === 'percentage' && v > 100) return 'percentage สูงสุด 100'
  }
  if (input.minimumAmount && Number(input.minimumAmount) < 0)
    return 'minimum amount ต้อง ≥ 0'
  if (input.usageLimit && Number(input.usageLimit) < 1)
    return 'usage limit ต้อง ≥ 1'
  if (!['active', 'disabled', 'scheduled'].includes(input.status))
    return 'status ไม่ถูกต้อง'
  return null
}

export async function createDiscount(
  shopSlug: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)
  const input = readForm(formData)
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const value =
    input.type === 'free_shipping' ? null : Number(input.value).toFixed(2)

  try {
    const [created] = await db
      .insert(discounts)
      .values({
        shopId: shop.id,
        code: input.code,
        title: input.title,
        status: input.status,
        type: input.type,
        value,
        appliesTo: 'all',
        customerEligibility: 'all',
        minimumAmount: input.minimumAmount ? Number(input.minimumAmount).toFixed(2) : null,
        usageLimit: input.usageLimit ? Number(input.usageLimit) : null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      })
      .returning({ id: discounts.id })
    revalidatePath(`/${shopSlug}/discounts`)
    redirect(`/${shopSlug}/discounts/${created!.id}`)
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'code นี้มีอยู่แล้วใน shop' }
    }
    throw error
  }
}

export async function updateDiscount(
  shopSlug: string,
  discountId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)
  const input = readForm(formData)
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const value =
    input.type === 'free_shipping' ? null : Number(input.value).toFixed(2)

  try {
    await db
      .update(discounts)
      .set({
        code: input.code,
        title: input.title,
        status: input.status,
        type: input.type,
        value,
        minimumAmount: input.minimumAmount ? Number(input.minimumAmount).toFixed(2) : null,
        usageLimit: input.usageLimit ? Number(input.usageLimit) : null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(discounts.id, discountId), eq(discounts.shopId, shop.id)))
    revalidatePath(`/${shopSlug}/discounts`)
    revalidatePath(`/${shopSlug}/discounts/${discountId}`)
    return { ok: true }
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'code นี้มีอยู่แล้วใน shop' }
    }
    throw error
  }
}

export async function deleteDiscount(
  shopSlug: string,
  discountId: string,
): Promise<void> {
  const { shop } = await requireShop(shopSlug)
  await db
    .delete(discounts)
    .where(and(eq(discounts.id, discountId), eq(discounts.shopId, shop.id)))
  revalidatePath(`/${shopSlug}/discounts`)
  redirect(`/${shopSlug}/discounts`)
}
