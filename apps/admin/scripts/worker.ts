/**
 * Background worker — รวม pg-boss subscribers + node-cron schedules ใน
 * process เดียว เพื่อประหยัด Railway service (ไม่ต้องตั้ง Cron Service
 * แยกอีก 4 ตัวที่ Railway dashboard)
 *
 * Service config:
 *   Build:  corepack enable && pnpm install --frozen-lockfile && pnpm --filter @pipecommerce/admin... build
 *   Start:  pnpm --filter @pipecommerce/admin worker
 *
 * Jobs (pg-boss):
 *   image-process / email-send / webhook-deliver
 *
 * Cron schedules (node-cron — UTC):
 *   19:00 daily   → report-snapshot   (02:00 ICT)
 *   20:00 daily   → loyalty-expire    (03:00 ICT)
 *   21:00 daily   → loyalty-reconcile (04:00 ICT)
 *   every 5 min   → sync-hostnames
 */
import cron from 'node-cron'
import {
  runLoyaltyExpire,
  runLoyaltyReconcile,
  runReportSnapshot,
  runSyncHostnames,
} from '../lib/cron-tasks.ts'
import { getQueue, QUEUES, type EmailSendJob, type ImageProcessJob } from '../lib/queue.ts'
import { processImageJob } from './workers/image-process.ts'
import { processEmailJob } from './workers/email-send.ts'

async function withLog<T>(label: string, fn: () => Promise<T>): Promise<void> {
  const start = Date.now()
  try {
    const result = await fn()
    console.log(`[cron] ${label} ok in ${Date.now() - start}ms`, result)
  } catch (err) {
    console.error(`[cron] ${label} failed in ${Date.now() - start}ms:`, err)
  }
}

async function main() {
  console.log('[worker] starting…')

  // ─── pg-boss queue subscribers ──────────────────────────────────────────
  const boss = await getQueue()
  boss.on('error', (err) => console.error('[worker] pg-boss error:', err))

  await boss.work<ImageProcessJob>(QUEUES.imageProcess, { batchSize: 2 }, async (jobs) => {
    for (const job of jobs) {
      try {
        await processImageJob(job.data)
      } catch (err) {
        console.error(`[worker] ${QUEUES.imageProcess} job ${job.id} failed:`, err)
        throw err
      }
    }
  })

  await boss.work<EmailSendJob>(QUEUES.email, { batchSize: 5 }, async (jobs) => {
    for (const job of jobs) {
      try {
        await processEmailJob(job.data)
      } catch (err) {
        console.error(`[worker] ${QUEUES.email} job ${job.id} failed:`, err)
        throw err
      }
    }
  })

  console.log('[worker] queue subscribed:', Object.values(QUEUES).join(', '))

  // ─── node-cron schedules (UTC) ──────────────────────────────────────────
  // หมายเหตุ: node-cron ใช้ server timezone (Railway = UTC)
  cron.schedule('0 19 * * *', () => withLog('report-snapshot', runReportSnapshot))
  cron.schedule('0 20 * * *', () => withLog('loyalty-expire', runLoyaltyExpire))
  cron.schedule('0 21 * * *', () => withLog('loyalty-reconcile', runLoyaltyReconcile))
  cron.schedule('*/5 * * * *', () => withLog('sync-hostnames', runSyncHostnames))

  console.log('[worker] cron schedules registered (4 jobs)')

  // Graceful shutdown
  const shutdown = async (sig: string) => {
    console.log(`[worker] ${sig} — stopping…`)
    cron.getTasks().forEach((t) => t.stop())
    await boss.stop({ graceful: true, timeout: 30_000 })
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
