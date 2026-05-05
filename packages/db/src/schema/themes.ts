import { sql } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from './_helpers.ts'

/**
 * System-managed themes (ไม่ใช่ per-shop)
 *
 * 5 themes ใน MVP: minimal, classic, bold, showcase, boutique
 * (ดู ADR-013)
 *
 * schema = settings_schema + sections schema + page templates declaration
 * available_on_plans = empty array หมายถึงใช้ได้ทุก plan
 */
export const themes = pgTable(
  'themes',
  {
    id: id(),
    code: text().notNull(),
    name: text().notNull(),
    description: text(),
    category: text(), // fashion | food | art | beauty | general
    previewImageR2Key: text(),
    thumbnailR2Key: text(),

    version: text().notNull(), // semver
    schema: jsonb().notNull(),

    isActive: boolean().notNull().default(true),
    availableOnPlans: uuid().array().notNull().default(sql`'{}'`),
    releasedAt: timestamp({ withTimezone: true }),
    deprecatedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('themes_code_version_unique').on(t.code, t.version)],
)

export type Theme = typeof themes.$inferSelect
export type NewTheme = typeof themes.$inferInsert
