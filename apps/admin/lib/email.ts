/**
 * Email notifications via Resend (admin-side)
 *
 * Stub mode (no RESEND_API_KEY) → log to console instead of send
 *
 * NOTE: ทำซ้ำกับ apps/storefront/lib/email.ts แต่เนื้อหา emails ไม่ overlap
 * (storefront ส่ง confirmation/receipt; admin ส่ง fulfillment/cancellation)
 * extract เป็น packages/email ทีหลังถ้าต้องใช้ shared template
 */
import { Resend } from 'resend'

type Money = string | number

type EmailShopInfo = {
  name: string
  currency: string
}

type EmailOrderInfo = {
  orderNumber: string
  totalPrice: Money
}

let _resend: Resend | undefined
function client() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!_resend) _resend = new Resend(key)
  return _resend
}

function fmt(currency: string, amount: Money): string {
  return `${currency} ${Number(amount).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sender(shopName: string): string {
  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? 'noreply@pipecommerce.local'
  return `${shopName} <${fromAddress}>`
}

async function send(args: {
  to: string
  from: string
  subject: string
  html: string
}): Promise<void> {
  const r = client()
  if (!r) {
    console.log('[email:stub] would send', { to: args.to, subject: args.subject })
    return
  }
  const res = await r.emails.send(args)
  if (res.error) {
    console.error('[email] send failed', res.error)
    throw new Error(`email send failed: ${res.error.message}`)
  }
}

function wrapper(args: {
  shopName: string
  heading: string
  intro: string
  ctaUrl: string
  ctaLabel: string
}): string {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:24px;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#222">
    <table style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
      <tr>
        <td style="padding:24px 28px">
          <div style="font-size:13px;color:#888;letter-spacing:0.5px;text-transform:uppercase">${escapeHtml(args.shopName)}</div>
          <h1 style="margin:8px 0 16px;font-size:22px">${escapeHtml(args.heading)}</h1>
          <p style="margin:0 0 20px;line-height:1.6">${args.intro}</p>
          <div style="margin-top:8px">
            <a href="${args.ctaUrl}" style="display:inline-block;padding:10px 20px;background:#222;color:#fff;text-decoration:none;border-radius:6px;font-size:14px">${escapeHtml(args.ctaLabel)}</a>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;border-top:1px solid #eee;font-size:12px;color:#888;text-align:center">
          ส่งโดย ${escapeHtml(args.shopName)} ผ่าน PipeCommerce
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendFulfillmentNotice(args: {
  to: string
  shop: EmailShopInfo
  order: EmailOrderInfo
  trackingUrl: string
}): Promise<void> {
  const { to, shop, order, trackingUrl } = args
  const html = wrapper({
    shopName: shop.name,
    heading: `จัดส่งแล้ว — #${order.orderNumber}`,
    intro: `ทางร้านได้จัดส่งคำสั่งซื้อของคุณแล้ว — รอรับสินค้าได้เลยครับ/ค่ะ`,
    ctaUrl: trackingUrl,
    ctaLabel: 'ติดตามคำสั่งซื้อ',
  })
  await send({
    to,
    from: sender(shop.name),
    subject: `[${shop.name}] จัดส่งแล้ว #${order.orderNumber}`,
    html,
  })
}

export async function sendRefundNotice(args: {
  to: string
  shop: EmailShopInfo
  order: EmailOrderInfo
  amount: Money
  isPartial: boolean
  reason?: string | null
  trackingUrl: string
}): Promise<void> {
  const { to, shop, order, amount, isPartial, reason, trackingUrl } = args
  const reasonHtml = reason
    ? `<p style="margin:0 0 16px;color:#666;font-size:14px">เหตุผล: ${escapeHtml(reason)}</p>`
    : ''
  const heading = isPartial
    ? `คืนเงินบางส่วน — #${order.orderNumber}`
    : `คืนเงินเรียบร้อย — #${order.orderNumber}`
  const intro = `ทางร้านได้คืนเงิน ${escapeHtml(fmt(shop.currency, amount))} ให้คุณแล้ว ${reasonHtml}`
  const html = wrapper({
    shopName: shop.name,
    heading,
    intro,
    ctaUrl: trackingUrl,
    ctaLabel: 'ดูรายละเอียด',
  })
  await send({
    to,
    from: sender(shop.name),
    subject: `[${shop.name}] คืนเงิน #${order.orderNumber}`,
    html,
  })
}

export async function sendCancellationNotice(args: {
  to: string
  shop: EmailShopInfo
  order: EmailOrderInfo
  reason?: string | null
  trackingUrl: string
}): Promise<void> {
  const { to, shop, order, reason, trackingUrl } = args
  const reasonHtml = reason
    ? `<p style="margin:0 0 16px;color:#666;font-size:14px">เหตุผล: ${escapeHtml(reason)}</p>`
    : ''
  const html = wrapper({
    shopName: shop.name,
    heading: `ยกเลิกคำสั่งซื้อ — #${order.orderNumber}`,
    intro: `คำสั่งซื้อของคุณถูกยกเลิกแล้ว ${reasonHtml} หากต้องการสอบถามเพิ่มเติม กรุณาติดต่อทางร้าน`,
    ctaUrl: trackingUrl,
    ctaLabel: 'ดูรายละเอียด',
  })
  await send({
    to,
    from: sender(shop.name),
    subject: `[${shop.name}] ยกเลิกคำสั่งซื้อ #${order.orderNumber}`,
    html,
  })
}
