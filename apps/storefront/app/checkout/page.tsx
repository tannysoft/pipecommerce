import { asc, eq } from '@pipecommerce/db'
import { cartItems, productVariants, products } from '@pipecommerce/db/schema'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCartByToken } from '@/lib/cart.ts'
import { db } from '@/lib/db.ts'
import { requireShopFromHost } from '@/lib/shop.ts'
import { CheckoutForm } from './checkout-form.tsx'

const fmtBaht = (raw: string | number) =>
  Number(raw).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default async function CheckoutPage() {
  const shop = await requireShopFromHost()
  const cart = await getCartByToken(shop.id)

  if (!cart) redirect('/cart')

  const lines = await db
    .select({
      itemId: cartItems.id,
      quantity: cartItems.quantity,
      variantTitle: productVariants.title,
      variantPrice: productVariants.price,
      productTitle: products.title,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(asc(cartItems.createdAt))

  if (lines.length === 0) redirect('/cart')

  const subtotal = lines.reduce(
    (s, l) => s + Number(l.variantPrice) * l.quantity,
    0,
  )

  const taxConfig = (shop.settings?.tax ?? {}) as {
    mode?: 'none' | 'inclusive_customer' | 'exclusive_customer' | 'shop_absorbs'
    rate?: number
    label?: string
  }
  const taxMode = taxConfig.mode ?? 'none'
  const taxRate =
    typeof taxConfig.rate === 'number' && taxConfig.rate >= 0 ? taxConfig.rate : 0
  const taxLabel = taxConfig.label ?? 'VAT'

  const shippingConfig = (shop.settings?.shipping ?? {}) as {
    defaultRate?: number
    freeThreshold?: number | null
  }
  const shippingBase =
    typeof shippingConfig.defaultRate === 'number' ? shippingConfig.defaultRate : 0
  const shippingThreshold =
    typeof shippingConfig.freeThreshold === 'number' ? shippingConfig.freeThreshold : null
  const shippingAmount =
    shippingThreshold !== null && subtotal >= shippingThreshold ? 0 : shippingBase

  let taxAmount = 0
  let total = subtotal + shippingAmount
  if (taxMode === 'exclusive_customer' && taxRate > 0) {
    taxAmount = subtotal * taxRate
    total = subtotal + taxAmount + shippingAmount
  } else if (taxMode === 'inclusive_customer' && taxRate > 0) {
    taxAmount = subtotal - subtotal / (1 + taxRate)
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <Link href="/cart" className="text-sm text-muted-foreground hover:text-foreground">
          ← ตะกร้า
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Checkout</h1>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <CheckoutForm />

        <aside className="rounded-xl border bg-card p-4 lg:sticky lg:top-4 lg:h-fit">
          <h2 className="font-semibold">สรุปคำสั่งซื้อ</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {lines.map((l) => (
              <li key={l.itemId} className="flex justify-between gap-3">
                <span className="flex-1">
                  {l.productTitle}
                  {l.variantTitle !== 'Default Title' ? (
                    <span className="ml-1 text-muted-foreground">· {l.variantTitle}</span>
                  ) : null}
                  <span className="ml-1 text-muted-foreground">× {l.quantity}</span>
                </span>
                <span className="font-mono">
                  ฿{fmtBaht(Number(l.variantPrice) * l.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-mono">฿{fmtBaht(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">ค่าส่ง</dt>
              <dd className="font-mono">
                {shippingAmount > 0 ? `฿${fmtBaht(shippingAmount)}` : 'ฟรี'}
              </dd>
            </div>
            {taxMode === 'exclusive_customer' && taxRate > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{taxLabel}</dt>
                <dd className="font-mono">฿{fmtBaht(taxAmount)}</dd>
              </div>
            ) : taxMode === 'inclusive_customer' && taxRate > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{taxLabel} (รวมในราคาแล้ว)</dt>
                <dd className="font-mono text-xs text-muted-foreground">฿{fmtBaht(taxAmount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-2 text-base">
              <dt className="font-medium">Total</dt>
              <dd className="font-mono font-semibold">฿{fmtBaht(total)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            ⚠ ตอนนี้ยังไม่ได้ผูก payment — order จะ status=pending
            ระบบ payment (Beam) มาใน phase ถัดไป
          </p>
        </aside>
      </div>
    </main>
  )
}
