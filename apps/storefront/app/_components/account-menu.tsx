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

// Delay ก่อนปิดเมื่อ mouse ออก — กัน flicker ตอนขยับเมาส์จาก avatar → menu
const CLOSE_DELAY_MS = 120

export function AccountMenu({ customer }: { customer: AccountMenuCustomer }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  function openNow() {
    clearCloseTimer()
    setOpen(true)
  }

  function scheduleClose() {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }

  // Click-outside / Escape สำหรับ keyboard + touch users
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

  // Cleanup timer on unmount
  useEffect(() => () => clearCloseTimer(), [])

  const initial = (customer.firstName?.[0] ?? customer.email[0] ?? '?').toUpperCase()
  const displayName = customer.firstName
    ? [customer.firstName, customer.lastName].filter(Boolean).join(' ')
    : 'บัญชี'

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
      onFocus={openNow}
      onBlur={scheduleClose}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm ring-2 ring-transparent transition hover:opacity-90 hover:ring-primary/30 focus-visible:ring-primary/50 focus-visible:outline-none"
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
          // Bridge gap: invisible padding-top เพื่อให้ pointer ข้ามไป menu ได้
          // โดยไม่หลุดจาก hover area (mt-2 + pseudo-spacer)
          className="absolute right-0 top-full z-50 w-60 pt-2 duration-150 animate-in fade-in-0 slide-in-from-top-1"
        >
          <div className="overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
            <div className="border-b px-3 py-2.5">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {customer.email}
              </p>
            </div>
            <div className="p-1">
              <Link
                href="/account"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
              >
                <User
                  className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden
                />
                บัญชีของฉัน
              </Link>
              <Link
                href="/account/orders"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
              >
                <Package
                  className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden
                />
                คำสั่งซื้อ
              </Link>
              <form action="/account/logout" method="post">
                <button
                  type="submit"
                  role="menuitem"
                  className="group flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none"
                >
                  <LogOut className="size-4" aria-hidden />
                  ออกจากระบบ
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
