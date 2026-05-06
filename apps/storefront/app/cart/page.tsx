import { and, asc, eq, isNull } from '@pipecommerce/db'
import {
  cartItems,
  productImages,
  productVariants,
  products,
} from '@pipecommerce/db/schema'
import { Button } from '@pipecommerce/ui'
import Link from 'next/link'
import { getCartByToken } from '@/lib/cart.ts'
import { db } from '@/lib/db.ts'
import { publicImageUrl } from '@/lib/image.ts'
import { requireShopFromHost } from '@/lib/shop.ts'
import { CartLineRow } from './cart-line-row.tsx'

const fmtBaht = (raw: string | number) =>
  Number(raw).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default async function CartPage() {
  const shop = await requireShopFromHost()
  const cart = await getCartByToken(shop.id)

  const lines = cart
    ? await db
        .select({
          itemId: cartItems.id,
          quantity: cartItems.quantity,
          variantId: productVariants.id,
          variantTitle: productVariants.title,
          variantPrice: productVariants.price,
          productId: products.id,
          productTitle: products.title,
          productHandle: products.handle,
          productStatus: products.status,
        })
        .from(cartItems)
        .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(eq(cartItems.cartId, cart.id))
        .orderBy(asc(cartItems.createdAt))
    : []

  // First image per product (สำหรับ thumbnail)
  const productIds = lines.map((l) => l.productId)
  const imageRows = productIds.length
    ? await db
        .select({
          productId: productImages.productId,
          r2KeyOrig: productImages.r2KeyOrig,
          position: productImages.position,
        })
        .from(productImages)
        .where(
          and(
            eq(productImages.shopId, shop.id),
            isNull(productImages.deletedAt),
          ),
        )
        .orderBy(asc(productImages.productId), asc(productImages.position))
    : []
  const firstImage = new Map<string, string>()
  for (const r of imageRows) {
    if (!firstImage.has(r.productId)) firstImage.set(r.productId, r.r2KeyOrig)
  }

  const subtotal = lines.reduce(
    (sum, l) => sum + Number(l.variantPrice) * l.quantity,
    0,
  )

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← {shop.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">ตะกร้าของคุณ</h1>
      </header>

      {lines.length === 0 ? (
        <div className="rounded-xl border bg-muted/40 p-12 text-center">
          <p className="text-muted-foreground">ตะกร้ายังว่างอยู่</p>
          <Link href="/products" className="mt-4 inline-block">
            <Button variant="outline">เลือกซื้อสินค้า</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {lines.map((line) => {
              const r2Key = firstImage.get(line.productId)
              return (
                <CartLineRow
                  key={line.itemId}
                  itemId={line.itemId}
                  quantity={line.quantity}
                  variantTitle={line.variantTitle}
                  productTitle={line.productTitle}
                  productHandle={line.productHandle}
                  unitPrice={line.variantPrice}
                  imageUrl={r2Key ? publicImageUrl(r2Key) : null}
                />
              )
            })}
          </div>

          <aside className="rounded-xl border bg-card p-4 lg:sticky lg:top-4 lg:h-fit">
            <h2 className="font-semibold">สรุป</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-mono">฿{fmtBaht(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">ค่าส่ง</dt>
                <dd className="text-xs text-muted-foreground">คิดที่ checkout</dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-base">
                <dt className="font-medium">Total</dt>
                <dd className="font-mono font-semibold">฿{fmtBaht(subtotal)}</dd>
              </div>
            </dl>
            <Link href="/checkout" className="mt-4 block">
              <Button className="w-full">ไปที่ Checkout</Button>
            </Link>
          </aside>
        </div>
      )}
    </main>
  )
}
