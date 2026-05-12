/**
 * Background worker — รันเป็น separate Railway service (process แยกจาก Next.js)
 *
 * Service config:
 *   Build:  corepack enable && pnpm install --frozen-lockfile && pnpm --filter @pipecommerce/admin... build
 *   Start:  node --experimental-strip-types apps/admin/scripts/worker.ts
 *
 * หรือ compile เป็น JS ก่อนถ้า node version เก่า
 *
 * Jobs ที่ subscribe:
 *   - image-process: download from R2 → resize 3 variants → upload back
 *   - email-send:    ส่ง email ผ่าน Resend
 *   - webhook-deliver: deliver shop webhooks
 */
import { getQueue, QUEUES, type EmailSendJob, type ImageProcessJob } from '../lib/queue.ts'
import { processImageJob } from './workers/image-process.ts'
import { processEmailJob } from './workers/email-send.ts'

async function main() {
  console.log('[worker] starting…')
  const boss = await getQueue()

  boss.on('error', (err) => {
    console.error('[worker] pg-boss error:', err)
  })

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

  console.log('[worker] subscribed to', Object.values(QUEUES).join(', '))

  // Graceful shutdown
  const shutdown = async (sig: string) => {
    console.log(`[worker] ${sig} — stopping…`)
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
