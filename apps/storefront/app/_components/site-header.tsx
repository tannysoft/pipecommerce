import { ShoppingBag, User } from 'lucide-react'
import Link from 'next/link'
import { getCartItemCount } from '@/lib/cart.ts'
import { getCustomer } from '@/lib/customer-session.ts'
import type { ShopMenuItem } from '@/lib/shop.ts'
import { AccountMenu } from './account-menu.tsx'
import { MobileMenu, type NavLink } from './mobile-menu.tsx'

const DEFAULT_NAV: NavLink[] = [
  { href: '/products', label: 'สินค้า' },
  { href: '/collections', label: 'คอลเลกชัน' },
  { href: '/blog', label: 'บทความ' },
]

/**
 * Sticky site header — แสดงทุกหน้าผ่าน root layout
 *
 * Layout:
 *   - mobile: [≡] {Logo|Name} ··· [🛒(n)] [Avatar/Login]
 *   - desktop: {Logo|Name} [menu items...] ··· [🛒(n)] [Avatar/Login]
 *
 * Menu items: shop เลือกเองใน admin settings → settings.menu
 * ถ้าไม่ตั้งจะใช้ default (สินค้า / คอลเลกชัน / บทความ)
 *
 * Logo: ถ้ามี logoUrl ใช้รูป, ไม่งั้นแสดงชื่อร้านเป็นข้อความ
 */
export async function SiteHeader({
  shopId,
  shopName,
  logoUrl,
  menu,
}: {
  shopId: string
  shopName: string
  logoUrl: string | null
  menu: ShopMenuItem[] | undefined
}) {
  const [customer, cartCount] = await Promise.all([
    getCustomer(),
    getCartItemCount(shopId),
  ])

  const navLinks: NavLink[] = menu && menu.length > 0 ? menu : DEFAULT_NAV

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <MobileMenu links={navLinks} />

        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          aria-label={shopName}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={shopName}
              className="h-8 max-w-[140px] object-contain"
            />
          ) : (
            <span className="truncate text-base font-semibold tracking-tight">
              {shopName}
            </span>
          )}
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
