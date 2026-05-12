import { ShoppingBag, User } from 'lucide-react'
import Link from 'next/link'
import { getCartItemCount } from '@/lib/cart.ts'
import { getCustomer } from '@/lib/customer-session.ts'
import { AccountMenu } from './account-menu.tsx'
import { MobileMenu, type NavLink } from './mobile-menu.tsx'

/**
 * Sticky site header — แสดงทุกหน้าผ่าน root layout
 *
 * Layout:
 *   - mobile: [≡] {Shop name} ··· [🛒(n)] [Avatar/Login]
 *   - desktop: {Shop name} [Products] [Collections] [Blog] ··· [🛒(n)] [Avatar/Login]
 *
 * Account avatar: ถ้ามี avatarUrl (เช่นจาก LINE/Google login) ใช้รูปจริง,
 * ไม่งั้น fallback เป็นตัวอักษรแรกของชื่อ/อีเมล
 */
export async function SiteHeader({
  shopId,
  shopName,
}: {
  shopId: string
  shopName: string
}) {
  const [customer, cartCount] = await Promise.all([
    getCustomer(),
    getCartItemCount(shopId),
  ])

  const navLinks: NavLink[] = [
    { href: '/products', label: 'สินค้า' },
    { href: '/collections', label: 'คอลเลกชัน' },
    { href: '/blog', label: 'บทความ' },
  ]

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <MobileMenu links={navLinks} />

        <Link
          href="/"
          className="truncate text-base font-semibold tracking-tight"
        >
          {shopName}
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/cart"
            aria-label={`ตะกร้า ${cartCount} รายการ`}
            className="relative inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm hover:bg-accent"
          >
            <ShoppingBag className="size-4" aria-hidden />
            <span className="hidden sm:inline">ตะกร้า</span>
            {cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </Link>

          {customer ? (
            <AccountMenu customer={customer} />
          ) : (
            <Link
              href="/account/login"
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm hover:bg-accent"
            >
              <User className="size-4" aria-hidden />
              <span className="hidden sm:inline">เข้าสู่ระบบ</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
