import { Resend } from 'resend'
import type { EmailSendJob } from '../../lib/queue.ts'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export async function processEmailJob(job: EmailSendJob) {
  if (!resend) {
    throw new Error('RESEND_API_KEY not set')
  }
  const from = job.from ?? process.env.RESEND_FROM_ADDRESS ?? 'noreply@pipecommerce.com'

  const res = await resend.emails.send({
    from,
    to: job.to,
    subject: job.subject,
    html: job.html,
    text: job.text,
    tags: job.tags
      ? Object.entries(job.tags).map(([name, value]) => ({ name, value }))
      : undefined,
  })

  if (res.error) {
    throw new Error(`Resend: ${res.error.message}`)
  }
}
