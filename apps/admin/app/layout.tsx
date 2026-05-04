import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PipeCommerce Admin',
  description: 'Manage your shop',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
