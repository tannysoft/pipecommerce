'use server'

import { and, eq } from '@pipecommerce/db'
import { loyaltyPrograms } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function saveLoyaltyProgram(
  shopSlug: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)

  const name = String(formData.get('name') ?? '').trim() || 'Loyalty Points'
  const isActive = formData.get('isActive') === 'on'
  const earnRateAmount = Number(formData.get('earnRateAmount') ?? 0)
  const earnExcludesDiscounts = formData.get('earnExcludesDiscounts') === 'on'
  const signupBonusPoints = Math.max(0, Math.floor(Number(formData.get('signupBonusPoints') ?? 0)))
  const redeemMinPoints = Math.max(1, Math.floor(Number(formData.get('redeemMinPoints') ?? 100)))
  const redeemValuePerPoint = Number(formData.get('redeemValuePerPoint') ?? 0)
  const redeemStep = Math.max(1, Math.floor(Number(formData.get('redeemStep') ?? 1)))
  const redeemMaxPctRaw = String(formData.get('redeemMaxPctOfOrder') ?? '').trim()
  const expiryMonthsRaw = String(formData.get('pointsExpiryMonths') ?? '').trim()

  if (!Number.isFinite(earnRateAmount) || earnRateAmount <= 0) {
    return { ok: false, error: 'earn rate ต้องเป็นตัวเลข > 0' }
  }
  if (!Number.isFinite(redeemValuePerPoint) || redeemValuePerPoint < 0) {
    return { ok: false, error: 'redeem value ต้องเป็นตัวเลข ≥ 0' }
  }
  const redeemMaxPct = redeemMaxPctRaw === '' ? null : Number(redeemMaxPctRaw)
  if (redeemMaxPct !== null && (!Number.isFinite(redeemMaxPct) || redeemMaxPct < 0 || redeemMaxPct > 100)) {
    return { ok: false, error: 'redeem max % ต้องอยู่ระหว่าง 0-100' }
  }
  const expiryMonths = expiryMonthsRaw === '' ? null : Math.floor(Number(expiryMonthsRaw))
  if (expiryMonths !== null && (!Number.isFinite(expiryMonths) || expiryMonths < 1)) {
    return { ok: false, error: 'expiry months ต้องเป็นจำนวนเต็ม ≥ 1' }
  }

  const [existing] = await db
    .select({ id: loyaltyPrograms.id })
    .from(loyaltyPrograms)
    .where(eq(loyaltyPrograms.shopId, shop.id))
    .limit(1)

  const payload = {
    name,
    isActive,
    earnRateAmount: earnRateAmount.toFixed(2),
    earnOnSubtotal: true,
    earnExcludesDiscounts,
    signupBonusPoints,
    redeemMinPoints,
    redeemValuePerPoint: redeemValuePerPoint.toFixed(4),
    redeemStep,
    redeemMaxPctOfOrder: redeemMaxPct !== null ? redeemMaxPct.toFixed(2) : null,
    pointsExpiryMonths: expiryMonths,
    expiryWarningDays: 30,
  }

  if (existing) {
    await db
      .update(loyaltyPrograms)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(loyaltyPrograms.id, existing.id))
  } else {
    await db.insert(loyaltyPrograms).values({ shopId: shop.id, ...payload })
  }

  revalidatePath(`/${shopSlug}/loyalty`)
  return { ok: true }
}
