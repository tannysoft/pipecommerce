import type { Metadata } from 'next'
import { Google_Sans, Noto_Sans_Thai } from 'next/font/google'
import './globals.css'

/**
 * Admin fonts (จาก Google Fonts ผ่าน next/font, self-hosted ตอน build)
 *   body    = Google Sans (latin) — fallback Noto Sans Thai สำหรับตัวไทย
 *   heading = Noto Sans Thai (รองรับ thai + latin)
 *
 * variable names ตั้งเฉพาะ ไม่ชนกับ Tailwind token (--font-sans /
 * --font-heading) ที่อ้างถึงตัวนี้อีกทีใน globals.css
 */
const googleSans = Google_Sans({
  subsets: ['latin'],
  variable: '--font-google-sans',
  display: 'swap',
  weight: ['400', '500', '700'],
})

const notoThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  variable: '--font-noto-thai',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'PipeCommerce Admin',
  description: 'Manage your shop',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${googleSans.variable} ${notoThai.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
