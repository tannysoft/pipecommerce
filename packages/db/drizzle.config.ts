import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Load .env from monorepo root (drizzle-kit ไม่ auto-load)
loadEnv({ path: '../../.env' })
loadEnv({ path: '../../.env.local', override: true })

// DATABASE_URL ต้องการเฉพาะตอน migrate/push/studio
// ส่วน generate ใช้ schema files อย่างเดียว — ปล่อย empty ไว้ได้
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  casing: 'snake_case',
  strict: true,
  verbose: true,
})
