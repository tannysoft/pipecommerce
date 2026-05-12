import { eq } from '@pipecommerce/db'
import { shopDomains } from '@pipecommerce/db/schema'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { DomainsManager } from './domains-manager.tsx'

export const metadata = { title: 'Custom domains' }

export default async function DomainsSettingsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const domains = await db
    .select()
    .from(shopDomains)
    .where(eq(shopDomains.shopId, shop.id))

  const fallbackOrigin = process.env.CF_FALLBACK_ORIGIN ?? null

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/${shopSlug}/settings`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Settings
        </Link>
        <h2 className="mt-1 text-2xl font-bold">Custom domains</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Domains</CardTitle>
          <CardDescription>
            ใช้ domain ของคุณเองเช่น <code>narakshop.com</code> · เราออก SSL cert ให้
            อัตโนมัติผ่าน Cloudflare for SaaS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DomainsManager
            shopSlug={shopSlug}
            domains={domains.map((d) => ({
              id: d.id,
              hostname: d.hostname,
              sslStatus: d.sslStatus,
              cfHostnameId: d.cfHostnameId,
              isPrimary: d.isPrimary,
              verifiedAt: d.verifiedAt?.toISOString() ?? null,
            }))}
            fallbackOrigin={fallbackOrigin}
          />
        </CardContent>
      </Card>
    </div>
  )
}
