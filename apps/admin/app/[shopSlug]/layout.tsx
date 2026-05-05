import { Button } from '@pipecommerce/ui'
import Link from 'next/link'
import { logout } from '@/app/actions.ts'
import { requireShop } from '@/lib/shop.ts'

/**
 * Shop-scoped layout — gate access ผ่าน requireShop()
 *
 * cache() ใน requireShop ทำให้ pages ใต้ layout เรียกซ้ำได้ฟรี
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

  const navItems = [
    { href: `/${shop.slug}/dashboard`, label: 'Dashboard' },
    { href: `/${shop.slug}/products`, label: 'Products' },
    { href: `/${shop.slug}/collections`, label: 'Collections' },
  ]

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between py-3">
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
          <nav className="-mb-px flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  )
}
