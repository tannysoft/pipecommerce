import { Button } from '@pipecommerce/ui'
import Link from 'next/link'
import { getCustomer } from '@/lib/customer-session.ts'

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const customer = await getCustomer()

  if (!customer) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/account"
              className="rounded px-3 py-1.5 text-muted-foreground hover:text-foreground"
            >
              บัญชี
            </Link>
            <Link
              href="/account/orders"
              className="rounded px-3 py-1.5 text-muted-foreground hover:text-foreground"
            >
              คำสั่งซื้อ
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{customer.email}</span>
            <form action="/account/logout" method="post">
              <Button type="submit" variant="outline" size="sm">
                ออกจากระบบ
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-4">{children}</main>
    </div>
  )
}
