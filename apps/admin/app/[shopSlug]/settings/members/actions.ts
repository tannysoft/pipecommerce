'use server'

import { and, eq, sql } from '@pipecommerce/db'
import { shopMembers } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

const VALID_ROLES = ['owner', 'admin', 'staff', 'viewer'] as const
type Role = (typeof VALID_ROLES)[number]

export type MemberResult = { ok: true } | { ok: false; error: string }

/**
 * Look up auth.users by email (Supabase auth schema)
 * ใช้ service-role connection — bypass RLS ได้ตามปกติ
 */
async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const rows = await db.execute<{ id: string; email: string }>(
    sql`SELECT id::text, email FROM auth.users WHERE email = ${email.toLowerCase()} LIMIT 1`,
  )
  return (rows as unknown as { id: string; email: string }[])[0] ?? null
}

export async function inviteMember(
  shopSlug: string,
  formData: FormData,
): Promise<MemberResult> {
  const { shop, user: actor } = await requireShop(shopSlug)

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const role = String(formData.get('role') ?? 'staff') as Role

  if (!email || !email.includes('@')) return { ok: false, error: 'อีเมลไม่ถูกต้อง' }
  if (!VALID_ROLES.includes(role)) return { ok: false, error: 'role ไม่ถูกต้อง' }

  const target = await findUserByEmail(email)
  if (!target) {
    return {
      ok: false,
      error: 'ยังไม่มี account นี้ — ให้เจ้าของอีเมลไป login ที่ /login ก่อน แล้วค่อย invite',
    }
  }

  if (target.id === actor.id) {
    return { ok: false, error: 'invite ตัวเองไม่ได้' }
  }

  try {
    await db.insert(shopMembers).values({
      shopId: shop.id,
      userId: target.id,
      role,
      acceptedAt: new Date(), // direct add — ไม่มี pending state ใน MVP
    })
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'user นี้เป็น member อยู่แล้ว' }
    }
    throw error
  }

  revalidatePath(`/${shopSlug}/settings/members`)
  return { ok: true }
}

export async function changeMemberRole(
  shopSlug: string,
  userId: string,
  formData: FormData,
): Promise<void> {
  const { shop, user: actor } = await requireShop(shopSlug)

  const role = String(formData.get('role') ?? '') as Role
  if (!VALID_ROLES.includes(role)) return

  // ห้ามเปลี่ยน role ของตัวเอง
  if (userId === actor.id) return

  await db
    .update(shopMembers)
    .set({ role })
    .where(and(eq(shopMembers.shopId, shop.id), eq(shopMembers.userId, userId)))

  revalidatePath(`/${shopSlug}/settings/members`)
}

export async function removeMember(shopSlug: string, userId: string): Promise<void> {
  const { shop, user: actor } = await requireShop(shopSlug)

  // ห้ามลบตัวเอง
  if (userId === actor.id) return

  await db
    .delete(shopMembers)
    .where(and(eq(shopMembers.shopId, shop.id), eq(shopMembers.userId, userId)))

  revalidatePath(`/${shopSlug}/settings/members`)
}
