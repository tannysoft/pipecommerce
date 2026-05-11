'use server'

import { and, eq } from '@pipecommerce/db'
import { customerGroupMembers, customerGroups } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function createGroup(
  shopSlug: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null

  if (!name) return { ok: false, error: 'กรุณากรอกชื่อ group' }

  try {
    await db.insert(customerGroups).values({
      shopId: shop.id,
      name,
      description,
      type: 'manual',
      perks: {},
    })
    revalidatePath(`/${shopSlug}/customers/groups`)
    return { ok: true }
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return { ok: false, error: 'group ชื่อนี้มีอยู่แล้ว' }
    }
    throw error
  }
}

export async function updateGroup(
  shopSlug: string,
  groupId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null

  if (!name) return { ok: false, error: 'กรุณากรอกชื่อ group' }

  await db
    .update(customerGroups)
    .set({ name, description, updatedAt: new Date() })
    .where(and(eq(customerGroups.id, groupId), eq(customerGroups.shopId, shop.id)))

  revalidatePath(`/${shopSlug}/customers/groups`)
  return { ok: true }
}

export async function deleteGroup(shopSlug: string, groupId: string): Promise<void> {
  const { shop } = await requireShop(shopSlug)
  await db
    .delete(customerGroups)
    .where(and(eq(customerGroups.id, groupId), eq(customerGroups.shopId, shop.id)))
  revalidatePath(`/${shopSlug}/customers/groups`)
  redirect(`/${shopSlug}/customers/groups`)
}

export async function assignCustomerToGroup(
  shopSlug: string,
  customerId: string,
  groupId: string,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)

  // Verify both belong to shop
  const [group] = await db
    .select({ id: customerGroups.id })
    .from(customerGroups)
    .where(and(eq(customerGroups.id, groupId), eq(customerGroups.shopId, shop.id)))
    .limit(1)
  if (!group) return { ok: false, error: 'ไม่พบ group' }

  await db
    .insert(customerGroupMembers)
    .values({
      groupId,
      customerId,
      shopId: shop.id,
      addedBy: 'manual',
    })
    .onConflictDoNothing()

  revalidatePath(`/${shopSlug}/customers/${customerId}`)
  return { ok: true }
}

export async function removeCustomerFromGroup(
  shopSlug: string,
  customerId: string,
  groupId: string,
): Promise<ActionResult> {
  const { shop } = await requireShop(shopSlug)

  await db
    .delete(customerGroupMembers)
    .where(
      and(
        eq(customerGroupMembers.groupId, groupId),
        eq(customerGroupMembers.customerId, customerId),
        eq(customerGroupMembers.shopId, shop.id),
      ),
    )

  revalidatePath(`/${shopSlug}/customers/${customerId}`)
  return { ok: true }
}
