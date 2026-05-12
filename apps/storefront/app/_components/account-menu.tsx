'use client'

import { LogOut, Package, User } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export type AccountMenuCustomer = {
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

export function AccountMenu({ customer }: { customer: AccountMenuCustomer }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const initial = (customer.firstName?.[0] ?? customer.email[0] ?? '?').toUpperCase()
  const displayName = customer.firstName
    ? [customer.firstName, customer.lastName].filter(Boolean).join(' ')
    : 'บัญชี'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        title={customer.email}
      >
        {customer.avatarUrl ? (
          // Avatar จาก social provider (LINE/Google) — ใช้ <img> ตรงๆ
          // เพราะ Next image optimization ถูกปิด (unoptimized: true)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={customer.avatarUrl}
            alt=""
            className="size-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>{initial}</span>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <div className="border-b px-3 py-2.5">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
          </div>
          <div className="p-1">
            <Link
              href="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
            >
              <User className="size-4" aria-hidden />
              บัญชีของฉัน
            </Link>
            <Link
              href="/account/orders"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
            >
              <Package className="size-4" aria-hidden />
              คำสั่งซื้อ
            </Link>
            <form action="/account/logout" method="post">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-destructive hover:bg-accent"
              >
                <LogOut className="size-4" aria-hidden />
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
