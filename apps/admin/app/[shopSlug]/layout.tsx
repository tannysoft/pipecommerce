import { createServerClient } from '@pipecommerce/auth/admin/server'
import { and, eq } from '@pipecommerce/db'
import { shopMembers, shops } from '@pipecommerce/db/schema'
import { Button } from '@pipecommerce/ui'
import { notFound, redirect } from 'next/navigation'
import { logout } from '@/app/actions.ts'
import { db } from '@/lib/db.ts'

/**
 * Shop-scoped layout — verify ว่า:
 *   1. user login แล้ว
 *   2. shop มีจริง (ไม่ deleted)
 *   3. user เป็น member ของ shop
 *
 * ถ้าผิด → notFound() (404) เพื่อไม่ให้ leak existence ของ shop
 */
export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [shop] = await db
    .select({ id: shops.id, slug: shops.slug, name: shops.name, status: shops.status })
    .from(shops)
    .innerJoin(
      shopMembers,
      and(eq(shopMembers.shopId, shops.id), eq(shopMembers.userId, user.id)),
    )
    .where(eq(shops.slug, shopSlug))
    .limit(1)

  if (!shop) notFound()

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold">{shop.name}</h1>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">/{shop.slug}</span>
              {shop.status === 'trial' ? ' · trial' : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{user.email}</span>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Logout
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  )
}
