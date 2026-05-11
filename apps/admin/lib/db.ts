import { createDb, type Db } from '@pipecommerce/db'

/**
 * Drizzle DB client สำหรับ admin app (server-side)
 *
 * รัน Next.js บน Railway → Postgres ผ่าน DATABASE_URL ตรงๆ
 *
 * Eager singleton — @auth/drizzle-adapter ตรวจ dialect ผ่าน Drizzle's `is()`
 * brand check ที่ต้องการ instance จริงๆ ไม่ใช่ Proxy. postgres-js เปิด connection
 * แบบ lazy อยู่แล้ว — สร้าง client ตอน module load ไม่เปิด socket
 */
declare global {
  // eslint-disable-next-line no-var
  var _pcAdminDb: Db | undefined
}

function init(): Db {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return createDb(url)
}

export const db: Db = globalThis._pcAdminDb ?? (globalThis._pcAdminDb = init())
