import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    // เราเสิร์ฟรูปจาก R2 (cdn.yourapp.com) ตรงๆ — ไม่ใช้ Next image optimization
    unoptimized: true,
  },
  experimental: {
    // ใส่เมื่อจำเป็น
  },
  // OpenNext จะ handle output แบบ Cloudflare Workers — ไม่ต้องตั้ง output: 'standalone'
}

// ตอน dev บน Workers runtime: เรียก initOpenNextCloudflareForDev จาก @opennextjs/cloudflare
// import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
// initOpenNextCloudflareForDev()

export default config
