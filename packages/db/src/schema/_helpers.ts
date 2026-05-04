import { sql } from 'drizzle-orm'
import { timestamp, uuid } from 'drizzle-orm/pg-core'

export const id = () => uuid().primaryKey().default(sql`gen_random_uuid()`)
export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()
export const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()
export const deletedAt = () => timestamp({ withTimezone: true })
