/**
 * Background worker — pg-boss queue subscribers + pg-boss cron schedules
 * + HTTP health check (สำหรับ Railway liveness probe)
 *
 * Service config:
 *   Build:  corepack enable && pnpm install --frozen-lockfile && pnpm --filter @pipecommerce/admin... build
 *   Start:  pnpm --filter @pipecommerce/admin worker
 *
 * Queues (pg-boss):
 *   image-process / email-send / webhook-deliver
 *   cron-* (one queue per cron task — fired by pg-boss schedule)
 *
 * Schedules (DB-persistent, UTC):
 *   19:00 daily   → cron-report-snapshot   (02:00 ICT)
 *   20:00 daily   → cron-loyalty-expire    (03:00 ICT)
 *   21:00 daily   → cron-loyalty-reconcile (04:00 ICT)
 *   every 5 min   → cron-sync-hostnames
 *
 * ทำไม pg-boss schedule แทน node-cron:
 *   - Schedule live ใน DB → worker restart ไม่ทำให้ schedule หาย
 *   - ถ้า worker crash ระหว่างรัน job, pg-boss retry auto (default 3 ครั้ง)
 *   - Multi-worker safe — schedule fires job 1 ครั้งเดียว (DB lock)
 *
 * HTTP health:
 *   GET /health → 200 ถ้า pg-boss + DB connection ปกติ, 503 ไม่งั้น
 *   Railway healthcheck ping ทุก ~30s — fail 3 ครั้ง → auto restart
 */
import { createServer } from 'node:http'
import { sql } from '@pipecommerce/db'
import { db } from '../lib/db.ts'
import {
  runLoyaltyExpire,
  runLoyaltyReconcile,
  runReportSnapshot,
  runSyncHostnames,
} from '../lib/cron-tasks.ts'
import { getQueue, QUEUES, type EmailSendJob, type ImageProcessJob } from '../lib/queue.ts'
import { processEmailJob } from './workers/email-send.ts'
import { processImageJob } from './workers/image-process.ts'

const CRON_QUEUES = {
  reportSnapshot: 'cron-report-snapshot',
  loyaltyExpire: 'cron-loyalty-expire',
  loyaltyReconcile: 'cron-loyalty-reconcile',
  syncHostnames: 'cron-sync-hostnames',
} as const

const SCHEDULES = [
  { queue: CRON_QUEUES.reportSnapshot, cron: '0 19 * * *', fn: runReportSnapshot },
  { queue: CRON_QUEUES.loyaltyExpire, cron: '0 20 * * *', fn: runLoyaltyExpire },
  { queue: CRON_QUEUES.loyaltyReconcile, cron: '0 21 * * *', fn: runLoyaltyReconcile },
  { queue: CRON_QUEUES.syncHostnames, cron: '*/5 * * * *', fn: runSyncHostnames },
] as const

// Liveness state — flipped to false ถ้า health probe จับว่า DB ค้าง
let healthy = true

async function main() {
  console.log('[worker] starting…')
  const boss = await getQueue()
  boss.on('error', (err) => {
    console.error('[worker] pg-boss error:', err)
    healthy = false
  })

  // pg-boss v10: ต้อง createQueue() ก่อนใช้ — schedules มี FK ไป queue table
  // createQueue idempotent ปลอดภัยรันซ้ำ
  const allQueues = [
    ...Object.values(QUEUES),
    ...SCHEDULES.map((s) => s.queue),
  ]
  for (const q of allQueues) {
    await boss.createQueue(q)
  }
  console.log('[worker] queues registered:', allQueues.join(', '))

  // ─── Queue subscribers ────────────────────────────────────────────────────
  await boss.work<ImageProcessJob>(QUEUES.imageProcess, { batchSize: 2 }, async (jobs) => {
    for (const job of jobs) await processImageJob(job.data)
  })
  await boss.work<EmailSendJob>(QUEUES.email, { batchSize: 5 }, async (jobs) => {
    for (const job of jobs) await processEmailJob(job.data)
  })
  console.log('[worker] queue subscribed:', Object.values(QUEUES).join(', '))

  // ─── Cron schedules ───────────────────────────────────────────────────────
  for (const s of SCHEDULES) {
    // Subscribe handler first (no-op data — handler just calls the fn)
    await boss.work(s.queue, { batchSize: 1 }, async (jobs) => {
      for (const job of jobs) {
        const start = Date.now()
        try {
          const result = await s.fn()
          console.log(`[cron] ${s.queue} ok in ${Date.now() - start}ms`, result)
        } catch (err) {
          console.error(`[cron] ${s.queue} failed in ${Date.now() - start}ms:`, err)
          throw err // pg-boss จะ retry
        }
        void job
      }
    })
    // Then register schedule — DB-persistent ใน pgboss.schedule
    await boss.schedule(s.queue, s.cron, undefined, { tz: 'UTC' })
  }
  console.log('[worker] cron schedules registered:', SCHEDULES.map((s) => s.queue).join(', '))

  // ─── Health server ────────────────────────────────────────────────────────
  const port = Number(process.env.PORT ?? 8080)
  const server = createServer(async (req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404).end('not found')
      return
    }
    if (!healthy) {
      res.writeHead(503).end('unhealthy')
      return
    }
    try {
      // Sanity ping DB — ค้างนานเกินไป จะถูก Railway probe ตัดเอง
      await db.execute(sql`SELECT 1`)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, uptime: process.uptime() }))
    } catch (err) {
      console.error('[health] db ping failed:', err)
      res.writeHead(503).end('db unreachable')
    }
  })
  server.listen(port, () => {
    console.log(`[worker] health server listening on :${port}/health`)
  })

  // ─── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async (sig: string) => {
    console.log(`[worker] ${sig} — stopping…`)
    server.close()
    await boss.stop({ graceful: true, timeout: 30_000 })
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  // Uncaught errors → ปล่อย Railway restart, ไม่ swallow
  process.on('unhandledRejection', (err) => {
    console.error('[worker] unhandledRejection:', err)
    healthy = false
  })
}

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
