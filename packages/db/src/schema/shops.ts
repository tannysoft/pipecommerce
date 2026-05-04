import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createdAt, deletedAt, id, updatedAt } from './_helpers.ts'

export const shops = pgTable('shops', {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  ownerUserId: uuid().notNull(),
  status: text().notNull().default('trial'), // active | suspended | trial
  currency: text().notNull().default('THB'),
  timezone: text().notNull().default('Asia/Bangkok'),
  themeId: uuid(),
  trialEndsAt: timestamp({ withTimezone: true }),
  settings: jsonb().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
})

export type Shop = typeof shops.$inferSelect
export type NewShop = typeof shops.$inferInsert
