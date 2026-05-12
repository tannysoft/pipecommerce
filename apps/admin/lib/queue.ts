import PgBoss from 'pg-boss'

/**
 * pg-boss singleton — Postgres-backed background job queue
 *
 * แทน Cloudflare Queues (เราเลิกใช้ CF Workers แล้ว) — job state เก็บใน
 * tables `pgboss.job`/`pgboss.archive` ที่ pg-boss สร้างเอง schema = `pgboss`
 *
 * Initialization: ครั้งแรกที่ใช้ start() จะ create schema + tables
 *
 * Lifecycle: รัน worker ใน Railway service เดียวกับ admin (ผ่าน entrypoint
 * `scripts/worker.ts`). job producers ใช้ `getQueue().send(...)` จาก server
 * actions / route handlers
 */
let bossPromise: Promise<PgBoss> | null = null

export function getQueue(): Promise<PgBoss> {
  if (bossPromise) return bossPromise
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set — pg-boss requires it')

  const boss = new PgBoss({
    connectionString: url,
    // เก็บ archive 30 วันแล้ว purge
    archiveCompletedAfterSeconds: 30 * 24 * 60 * 60,
    archiveFailedAfterSeconds: 30 * 24 * 60 * 60,
    deleteAfterDays: 60,
    retentionDays: 30,
    application_name: 'pipecommerce-admin',
  })

  bossPromise = boss.start().then(() => boss)
  return bossPromise
}

export const QUEUES = {
  imageProcess: 'image-process',
  email: 'email-send',
  webhookDeliver: 'webhook-deliver',
} as const

export type ImageProcessJob = {
  imageId: string
  r2Key: string
  shopId: string
}

export type EmailSendJob = {
  to: string
  from?: string
  subject: string
  html: string
  text?: string
  tags?: Record<string, string>
}

export type WebhookDeliverJob = {
  deliveryId: string
}
