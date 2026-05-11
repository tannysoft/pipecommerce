import { integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id } from './_helpers.ts'

/**
 * Auth.js v5 (NextAuth) schema — สำหรับ admin user authentication
 *
 * ใช้กับ @auth/drizzle-adapter:
 *   import { DrizzleAdapter } from '@auth/drizzle-adapter'
 *   adapter: DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, ... })
 *
 * แทน Supabase `auth.users` table (เดิม)
 *
 * Reference: https://authjs.dev/reference/adapter/drizzle
 */

export const users = pgTable('users', {
  id: id(),
  name: text(),
  email: text().notNull().unique(),
  emailVerified: timestamp({ withTimezone: true, mode: 'date' }),
  image: text(),
  createdAt: createdAt(),
})

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refresh_token: text(),
    access_token: text(),
    expires_at: integer(),
    token_type: text(),
    scope: text(),
    id_token: text(),
    session_state: text(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
)

export const sessions = pgTable('sessions', {
  sessionToken: text().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
)

export type AuthUser = typeof users.$inferSelect
export type NewAuthUser = typeof users.$inferInsert
