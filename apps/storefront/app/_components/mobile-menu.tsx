'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export type NavLink = { href: string; label: string }

/**
 * Hamburger menu — แสดงเฉพาะ mobile (`<md`)
 * เปิด overlay drawer แล้วโชว์ nav links เหมือน desktop ในรูปแบบ stack
 */
export function MobileMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false)

  // Lock body scroll ตอนเปิด drawer
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onEsc)
    return () => {
      document.body.style.overflow = original
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        aria-label="เปิดเมนู"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-14 items-center justify-end border-b px-4">
            <button
              type="button"
              aria-label="ปิดเมนู"
              onClick={() => setOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  )
}
