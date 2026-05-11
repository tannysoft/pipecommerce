import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.ts'

export type Db = ReturnType<typeof createDb>

/**
 * Create a Drizzle DB client.
 *
 * In production on Cloudflare Workers, pass `env.HYPERDRIVE.connectionString`.
 * For local dev / migrations, pass `process.env.DATABASE_URL`.
 *
 * postgres-js options ที่ต้องตั้งสำหรับ CF Workers + Hyperdrive:
 *   - prepare: false       — Supavisor transaction-mode + Hyperdrive ไม่ support prepared statements
 *   - fetch_types: false   — ห้าม fetch pg type metadata (extra roundtrip + hang ใน Workers)
 *   - max: 1               — Hyperdrive pool อยู่แล้ว — postgres-js ใช้ 1 connection ต่อ isolate ก็พอ
 *   - idle_timeout: 20     — close idle connection ก่อน Workers isolate eviction
 *   - connect_timeout: 10  — fail fast ถ้า Hyperdrive ไม่ตอบ (กัน hung worker)
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, {
    prepare: false,
    fetch_types: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  })
  return drizzle(client, { schema, casing: 'snake_case' })
}

export * from './schema/index.ts'
export {
  sql,
  eq, ne, and, or, not,
  asc, desc,
  gt, gte, lt, lte,
  inArray, notInArray,
  isNull, isNotNull,
  like, ilike,
  arrayContains, arrayContained, arrayOverlaps,
  count, sum, avg, min, max,
} from 'drizzle-orm'
