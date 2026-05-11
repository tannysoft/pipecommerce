import { eq } from '@pipecommerce/db'
import { shopMembers, shops } from '@pipecommerce/db/schema'
import { redirect } from 'next/navigation'
import { auth } from '@/auth.ts'
import { db } from '@/lib/db.ts'

/**
 * Root admin route — verify user authenticated + redirect ตาม memberships
 *
 * 0 shops → /onboarding
 * 1+ shops → /{slug}/dashboard (default ตัวแรก, multi-shop picker ทำทีหลัง)
 */
export default async function AdminHome() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const memberships = await db
    .select({ slug: shops.slug })
    .from(shopMembers)
    .innerJoin(shops, eq(shopMembers.shopId, shops.id))
    .where(eq(shopMembers.userId, session.user.id))
    .limit(2)

  if (memberships.length === 0) redirect('/onboarding')

  // TODO: memberships.length > 1 → /shops picker (จำตัวสุดท้ายผ่าน cookie)
  redirect(`/${memberships[0]!.slug}/dashboard`)
}
