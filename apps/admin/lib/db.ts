import { createDb, type Db } from '@pipecommerce/db'

/**
 * Drizzle DB client สำหรับ admin app (server-side เท่านั้น)
 *
 * Dev (next dev): module-level singleton + globalThis cache เพื่อไม่ให้
 *   hot-reload สร้าง connection ใหม่ทุกครั้ง (connection leak)
 *
 * Production บน CF Workers: ผ่าน Hyperdrive (binding) — สร้าง client
 *   per-request ผ่าน env.HYPERDRIVE.connectionString — pattern เดียวกับ
 *   storefront. ตอนนี้ admin run ผ่าน next dev → ใช้ DATABASE_URL ตรง
 *
 * ห้าม import จาก client component — ตัว postgres-js ไม่ทำงานบน browser
 */
declare global {
  // eslint-disable-next-line no-var
  var _pcAdminDb: Db | undefined
}

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')

export const db: Db = globalThis._pcAdminDb ?? createDb(url)
if (process.env.NODE_ENV !== 'production') globalThis._pcAdminDb = db
