import path from 'node:path'
import type { NextConfig } from 'next'

// monorepo root = 2 ชั้นเหนือ apps/admin
const workspaceRoot = path.resolve(process.cwd(), '..', '..')

const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // ระบุ workspace root ไม่ให้ Next เดาผิดจาก lockfile ใน home dir
  turbopack: {
    root: workspaceRoot,
  },
  outputFileTracingRoot: workspaceRoot,
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default config
