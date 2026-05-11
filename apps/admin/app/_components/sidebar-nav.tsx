'use client'

import {
  BarChart3,
  Bookmark,
  FileText,
  Gift,
  Image as ImageIcon,
  LayoutDashboard,
  Package,
  Palette,
  Percent,
  Settings,
  ShoppingBag,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type Section = {
  title: string
  items: NavItem[]
}

export function SidebarNav({ shopSlug }: { shopSlug: string }) {
  const pathname = usePathname()

  const sections: Section[] = [
    {
      title: '',
      items: [
        { href: `/${shopSlug}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
        { href: `/${shopSlug}/orders`, label: 'Orders', icon: ShoppingBag },
        { href: `/${shopSlug}/customers`, label: 'Customers', icon: Users },
      ],
    },
    {
      title: 'Catalog',
      items: [
        { href: `/${shopSlug}/products`, label: 'Products', icon: Package },
        { href: `/${shopSlug}/collections`, label: 'Collections', icon: Bookmark },
      ],
    },
    {
      title: 'Marketing',
      items: [
        { href: `/${shopSlug}/discounts`, label: 'Discounts', icon: Percent },
        { href: `/${shopSlug}/loyalty`, label: 'Loyalty', icon: Gift },
        // Newsletter — hidden in Phase 1 for Thai market (use LINE OA / SMS instead)
        // { href: `/${shopSlug}/newsletter`, label: 'Newsletter', icon: Mail },
      ],
    },
    {
      title: 'Content',
      items: [
        { href: `/${shopSlug}/articles`, label: 'Articles', icon: FileText },
        { href: `/${shopSlug}/pages`, label: 'Pages', icon: FileText },
        { href: `/${shopSlug}/galleries`, label: 'Galleries', icon: ImageIcon },
      ],
    },
    {
      title: 'Storefront',
      items: [
        { href: `/${shopSlug}/theme`, label: 'Theme', icon: Palette },
      ],
    },
    {
      title: 'Analytics',
      items: [
        { href: `/${shopSlug}/dashboard`, label: 'Reports', icon: BarChart3 },
      ],
    },
    {
      title: '',
      items: [
        { href: `/${shopSlug}/settings`, label: 'Settings', icon: Settings },
      ],
    },
  ]

  function isActive(href: string): boolean {
    if (href.endsWith('/dashboard')) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="flex flex-col gap-3 py-3">
      {sections.map((section, sIdx) => (
        <div key={sIdx} className="space-y-0.5 px-3">
          {section.title ? (
            <h3 className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {section.title}
            </h3>
          ) : null}
          {section.items.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-foreground/5 font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
