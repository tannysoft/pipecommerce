import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import { headers } from 'next/headers'
import { lookupShopByHost } from '@/lib/shop.ts'

export default async function HomePage() {
  const h = await headers()
  const host = h.get('x-shop-host') ?? ''
  const shop = host ? await lookupShopByHost(host) : null

  if (!shop) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <h1 className="text-2xl font-bold">PipeCommerce</h1>
        <p className="text-muted-foreground">Multi-tenant e-commerce platform.</p>
        {host ? (
          <p className="text-sm text-destructive">
            ไม่พบร้านสำหรับ <span className="font-mono">{host}</span>
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          ทดลองใน dev: เปิด <span className="font-mono">{'{your-shop-slug}'}.localhost:3000</span>
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">{shop.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">/{shop.slug}</span>
          {shop.status === 'trial' ? ' · trial' : null}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 3e verified ✓</CardTitle>
          <CardDescription>
            Storefront middleware → host → shop lookup ทำงาน
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            host = <span className="font-mono">{host}</span>
          </p>
          <p>
            ถัดไป — render product list / collections / cart (Phase 3f+)
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
