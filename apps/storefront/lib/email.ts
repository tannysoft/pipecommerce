/**
 * Email notifications via Resend
 *
 * Sender: "Shop Name <RESEND_FROM_ADDRESS>" — ใช้ shared platform domain
 * (per-shop sender domain มาทีหลัง — ต้อง verify domain ผ่าน Resend API)
 *
 * ถ้าไม่มี RESEND_API_KEY → log ไป console แทนส่งจริง (dev mode)
 * เพื่อให้ dev run ได้โดยไม่ต้อง setup Resend
 */
import { Resend } from 'resend'

type Money = string | number
type LineItem = {
  productTitle: string
  variantTitle?: string | null
  quantity: number
  price: Money
}

type EmailShopInfo = {
  name: string
  currency: string
}

type EmailOrderInfo = {
  orderNumber: string
  totalPrice: Money
  subtotalPrice: Money
  totalShipping: Money
  totalTax: Money
  totalDiscounts: Money
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

function lineItemsHtml(lines: LineItem[], currency: string): string {
  return lines
    .map((l) => {
      const total = Number(l.price) * l.quantity
      const variant = l.variantTitle
        ? `<div style="color:#666;font-size:13px">${escapeHtml(l.variantTitle)}</div>`
        : ''
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee">
            <div style="font-weight:500">${escapeHtml(l.productTitle)}</div>
            ${variant}
            <div style="color:#666;font-size:13px">${l.quantity} × ${fmt(currency, l.price)}</div>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">
            ${fmt(currency, total)}
          </td>
        </tr>`
    })
    .join('')
}

function summaryHtml(order: EmailOrderInfo, currency: string): string {
  const rows: string[] = []
  rows.push(
    `<tr><td style="padding:4px 0;color:#666">Subtotal</td><td style="padding:4px 0;text-align:right">${fmt(currency, order.subtotalPrice)}</td></tr>`,
  )
  if (Number(order.totalDiscounts) > 0) {
    rows.push(
      `<tr><td style="padding:4px 0;color:#666">Discounts</td><td style="padding:4px 0;text-align:right">-${fmt(currency, order.totalDiscounts)}</td></tr>`,
    )
  }
  rows.push(
    `<tr><td style="padding:4px 0;color:#666">Shipping</td><td style="padding:4px 0;text-align:right">${fmt(currency, order.totalShipping)}</td></tr>`,
  )
  rows.push(
    `<tr><td style="padding:4px 0;color:#666">Tax</td><td style="padding:4px 0;text-align:right">${fmt(currency, order.totalTax)}</td></tr>`,
  )
  rows.push(
    `<tr><td style="padding:8px 0;font-weight:600;border-top:1px solid #ddd">Total</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #ddd">${fmt(currency, order.totalPrice)}</td></tr>`,
  )
  return `<table style="width:100%;font-size:14px">${rows.join('')}</table>`
}

function wrapper(args: {
  shopName: string
  heading: string
  intro: string
  bodyHtml: string
  ctaUrl: string
  ctaLabel: string
}): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(args.heading)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#222">
    <table style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
      <tr>
        <td style="padding:24px 28px">
          <div style="font-size:13px;color:#888;letter-spacing:0.5px;text-transform:uppercase">${escapeHtml(args.shopName)}</div>
          <h1 style="margin:8px 0 16px;font-size:22px">${escapeHtml(args.heading)}</h1>
          <p style="margin:0 0 20px;line-height:1.6">${args.intro}</p>
          ${args.bodyHtml}
          <div style="margin-top:24px">
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

export async function sendOrderConfirmation(args: {
  to: string
  shop: EmailShopInfo
  order: EmailOrderInfo
  lines: LineItem[]
  trackingUrl: string
}): Promise<void> {
  const { to, shop, order, lines, trackingUrl } = args
  const html = wrapper({
    shopName: shop.name,
    heading: `ได้รับคำสั่งซื้อ #${order.orderNumber}`,
    intro: `ขอบคุณสำหรับการสั่งซื้อ — เราได้รับคำสั่งซื้อของคุณแล้ว สถานะการชำระเงิน: <strong>รอชำระ</strong>`,
    bodyHtml: `
      <table style="width:100%;font-size:14px;margin-bottom:16px">${lineItemsHtml(lines, shop.currency)}</table>
      ${summaryHtml(order, shop.currency)}
    `,
    ctaUrl: trackingUrl,
    ctaLabel: 'ดูสถานะ + ชำระเงิน',
  })

  await send({
    to,
    from: sender(shop.name),
    subject: `[${shop.name}] ได้รับคำสั่งซื้อ #${order.orderNumber}`,
    html,
  })
}

export async function sendMagicLink(args: {
  to: string
  shop: EmailShopInfo
  link: string
}): Promise<void> {
  const { to, shop, link } = args
  const html = wrapper({
    shopName: shop.name,
    heading: 'เข้าสู่ระบบ',
    intro: `คลิกปุ่มด้านล่างเพื่อเข้าสู่ระบบบัญชีของคุณที่ ${escapeHtml(shop.name)} — ลิงก์มีอายุ 15 นาที หากคุณไม่ได้ขอ ignore email ฉบับนี้ได้`,
    bodyHtml: '',
    ctaUrl: link,
    ctaLabel: 'เข้าสู่ระบบ',
  })
  await send({
    to,
    from: sender(shop.name),
    subject: `[${shop.name}] ลิงก์เข้าสู่ระบบ`,
    html,
  })
}

export async function sendPaymentReceipt(args: {
  to: string
  shop: EmailShopInfo
  order: EmailOrderInfo
  trackingUrl: string
}): Promise<void> {
  const { to, shop, order, trackingUrl } = args
  const html = wrapper({
    shopName: shop.name,
    heading: `ชำระเงินสำเร็จ — #${order.orderNumber}`,
    intro: `เราได้รับการชำระเงินของคุณแล้ว ${fmt(shop.currency, order.totalPrice)} ทางร้านจะดำเนินการจัดส่งเร็วๆ นี้`,
    bodyHtml: summaryHtml(order, shop.currency),
    ctaUrl: trackingUrl,
    ctaLabel: 'ติดตามคำสั่งซื้อ',
  })

  await send({
    to,
    from: sender(shop.name),
    subject: `[${shop.name}] ชำระเงินสำเร็จ #${order.orderNumber}`,
    html,
  })
}
