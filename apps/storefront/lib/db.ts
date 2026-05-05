import { createDb, type Db } from '@pipecommerce/db'

/**
 * Drizzle DB client สำหรับ storefront (server-side เท่านั้น)
 *
 * Pattern เดียวกับ apps/admin/lib/db.ts — globalThis singleton
 * ใน dev เพื่อกัน connection leak จาก hot reload
 *
 * Production บน CF Workers จะ swap เป็น per-request client ที่อ่าน
 * env.HYPERDRIVE.connectionString
 */
declare global {
  // eslint-disable-next-line no-var
  var _pcStorefrontDb: Db | undefined
}

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')

export const db: Db = globalThis._pcStorefrontDb ?? createDb(url)
if (process.env.NODE_ENV !== 'production') globalThis._pcStorefrontDb = db
