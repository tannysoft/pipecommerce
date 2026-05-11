import { createDb, type Db } from '@pipecommerce/db'

/**
 * Drizzle DB client สำหรับ storefront (server-side)
 *
 * Eager singleton (เหตุผลเดียวกับ apps/admin/lib/db.ts)
 */
declare global {
  // eslint-disable-next-line no-var
  var _pcStorefrontDb: Db | undefined
}

function init(): Db {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return createDb(url)
}

export const db: Db = globalThis._pcStorefrontDb ?? (globalThis._pcStorefrontDb = init())
