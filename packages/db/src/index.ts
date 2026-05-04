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
 * `prepare: false` is required for Supavisor transaction-mode pooling and
 * Hyperdrive (both don't support prepared statements across connections).
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, {
    prepare: false,
    max: 5,
  })
  return drizzle(client, { schema, casing: 'snake_case' })
}

export * from './schema/index.ts'
export { sql, eq, and, or, not, asc, desc, gt, gte, lt, lte, inArray } from 'drizzle-orm'
