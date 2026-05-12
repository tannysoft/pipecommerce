import Link from 'next/link'
import { getCustomer } from '@/lib/customer-session.ts'
import { AccountMenu } from './account-menu.tsx'

/**
 * Sticky site header — แสดงทุกหน้าผ่าน root layout
 *
 * - ซ้าย: ชื่อร้าน (link กลับ home)
 * - ขวา: cart + account zone
 *   - ถ้าล็อกอิน: avatar circle → dropdown (บัญชี/คำสั่งซื้อ/ออกจากระบบ)
 *   - ถ้ายัง: ลิงก์ "เข้าสู่ระบบ"
 */
export async function SiteHeader({ shopName }: { shopName: string }) {
  const customer = await getCustomer()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="truncate text-base font-semibold tracking-tight">
          {shopName}
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/cart"
            className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm hover:bg-accent"
          >
            <span aria-hidden>🛒</span>
            <span className="hidden sm:inline">ตะกร้า</span>
          </Link>

          {customer ? (
            <AccountMenu customer={customer} />
          ) : (
            <Link
              href="/account/login"
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm hover:bg-accent"
            >
              <span aria-hidden>👤</span>
              <span className="hidden sm:inline">เข้าสู่ระบบ</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
