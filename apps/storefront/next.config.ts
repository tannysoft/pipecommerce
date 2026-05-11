import path from 'node:path'
import type { NextConfig } from 'next'

const workspaceRoot = path.resolve(process.cwd(), '..', '..')

const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  turbopack: {
    root: workspaceRoot,
  },
  outputFileTracingRoot: workspaceRoot,
  images: {
    unoptimized: true,
  },
}

export default config
