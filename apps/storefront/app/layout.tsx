import { eq } from '@pipecommerce/db'
import { shopAnnouncementBars } from '@pipecommerce/db/schema'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { AnnouncementBar } from '@/app/_components/announcement-bar.tsx'
import { SiteFooter } from '@/app/_components/site-footer.tsx'
import { SiteHeader } from '@/app/_components/site-header.tsx'
import { db } from '@/lib/db.ts'
import { getFontConfig } from '@/lib/fonts.ts'
import { lookupShopByHost, resolveShopHost } from '@/lib/shop.ts'
import './globals.css'

export const metadata: Metadata = {
  title: 'PipeCommerce',
  description: 'Multi-tenant e-commerce platform',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  console.log('[layout] start')
  const host = await resolveShopHost()
  console.log('[layout] resolved host:', host)
  const shop = host
    ? await Promise.race([
        lookupShopByHost(host),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            console.error('[layout] lookupShopByHost TIMEOUT (8s)')
            resolve(null)
          }, 8000),
        ),
      ])
    : null
  console.log('[layout] shop:', shop?.slug ?? 'none')

  const fonts = getFontConfig(shop?.settings.fonts ?? null)
  const sameUrl = fonts.headingUrl === fonts.bodyUrl

  let announcementBar: {
    shopId: string
    messages: Array<{ text: string; link?: string | null; link_text?: string | null }>
    isDismissible: boolean
    backgroundColor: string | null
    textColor: string | null
  } | null = null
  if (shop) {
    const now = new Date()
    const [bar] = await db
      .select()
      .from(shopAnnouncementBars)
      .where(eq(shopAnnouncementBars.shopId, shop.id))
      .limit(1)
    if (
      bar &&
      bar.isActive &&
      (!bar.startsAt || bar.startsAt <= now) &&
      (!bar.endsAt || bar.endsAt > now)
    ) {
      const messages = (bar.messages as Array<{
        text?: string
        link?: string | null
        link_text?: string | null
      }>) ?? []
      const valid = messages.filter((m): m is { text: string; link?: string | null; link_text?: string | null } => Boolean(m.text))
      if (valid.length > 0) {
        announcementBar = {
          shopId: shop.id,
          messages: valid,
          isDismissible: bar.isDismissible,
          backgroundColor: bar.backgroundColor,
          textColor: bar.textColor,
        }
      }
    }
  }

  return (
    <html
      lang="th"
      style={
        {
          '--font-body': `"${fonts.body.family}"`,
          '--font-heading': `"${fonts.heading.family}"`,
        } as CSSProperties
      }
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={fonts.bodyUrl} />
        {!sameUrl ? <link rel="stylesheet" href={fonts.headingUrl} /> : null}
      </head>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        {announcementBar ? <AnnouncementBar {...announcementBar} /> : null}
        {shop ? <SiteHeader shopId={shop.id} shopName={shop.name} /> : null}
        <div className="flex-1">{children}</div>
        {shop ? <SiteFooter shopName={shop.name} /> : null}
      </body>
    </html>
  )
}
