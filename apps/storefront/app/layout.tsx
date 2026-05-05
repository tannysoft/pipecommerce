import type { Metadata } from 'next'
import { headers } from 'next/headers'
import type { CSSProperties } from 'react'
import { getFontConfig } from '@/lib/fonts.ts'
import { lookupShopByHost } from '@/lib/shop.ts'
import './globals.css'

export const metadata: Metadata = {
  title: 'PipeCommerce',
  description: 'Multi-tenant e-commerce platform',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const host = h.get('x-shop-host') ?? ''
  const shop = host ? await lookupShopByHost(host) : null

  const fonts = getFontConfig(shop?.settings.fonts ?? null)
  const sameUrl = fonts.headingUrl === fonts.bodyUrl

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
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
