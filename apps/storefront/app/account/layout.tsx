import Link from 'next/link'
import { getCustomer } from '@/lib/customer-session.ts'

/**
 * Account section sub-nav — site-wide header (จาก root layout) มี account dropdown
 * อยู่แล้ว, ตรงนี้แค่เพิ่มแถบ tab สำหรับสลับระหว่างหน้าใน /account
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const customer = await getCustomer()

  if (!customer) {
    return <main className="mx-auto max-w-4xl p-4">{children}</main>
  }

  return (
    <main className="mx-auto max-w-4xl p-4">
      <nav className="mb-6 flex items-center gap-1 border-b text-sm">
        <Link
          href="/account"
          className="rounded-t px-4 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          บัญชี
        </Link>
        <Link
          href="/account/orders"
          className="rounded-t px-4 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          คำสั่งซื้อ
        </Link>
      </nav>
      {children}
    </main>
  )
}
