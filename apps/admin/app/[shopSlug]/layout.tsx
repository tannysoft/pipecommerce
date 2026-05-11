import { Button } from '@pipecommerce/ui'
import { Store } from 'lucide-react'
import Link from 'next/link'
import { logout } from '@/app/actions.ts'
import { SidebarNav } from '@/app/_components/sidebar-nav.tsx'
import { requireShop } from '@/lib/shop.ts'

/**
 * Shop-scoped layout — Shopify-style sidebar nav
 *
 * Layout: fixed sidebar (left) + main content (right)
 * Sidebar grouped: Catalog / Marketing / Content / Analytics / Settings
 */
export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop, user } = await requireShop(shopSlug)

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
            <Store className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{shop.name}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              /{shop.slug}
              {shop.status === 'trial' ? ' · trial' : ''}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav shopSlug={shop.slug} />
        </div>

        <div className="border-t px-3 py-3">
          <p className="truncate px-2 text-xs text-muted-foreground" title={user.email}>
            {user.email}
          </p>
          <form action={logout} className="mt-1.5">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              ออกจากระบบ
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <Link href={`/${shop.slug}/dashboard`} className="text-sm font-semibold">
            {shop.name}
          </Link>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Logout
            </Button>
          </form>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
