import { createServerClient } from '@pipecommerce/auth/admin/server'
import { eq } from '@pipecommerce/db'
import { shopMembers, shops } from '@pipecommerce/db/schema'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db.ts'

/**
 * Root admin route — middleware รับประกันว่า user login แล้ว
 * (ไม่งั้น redirect /login ไปก่อนถึงที่นี่)
 *
 * 0 shops → /onboarding
 * 1+ shops → /{slug}/dashboard (default ตัวแรก, multi-shop picker ทำทีหลัง)
 */
export default async function AdminHome() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const memberships = await db
    .select({ slug: shops.slug })
    .from(shopMembers)
    .innerJoin(shops, eq(shopMembers.shopId, shops.id))
    .where(eq(shopMembers.userId, user.id))
    .limit(2)

  if (memberships.length === 0) redirect('/onboarding')

  // TODO: memberships.length > 1 → /shops picker (จำตัวสุดท้ายผ่าน cookie)
  redirect(`/${memberships[0]!.slug}/dashboard`)
}
