import { eq } from '@pipecommerce/db'
import { loyaltyPrograms } from '@pipecommerce/db/schema'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { LoyaltyForm } from './loyalty-form.tsx'

export default async function LoyaltyPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop } = await requireShop(shopSlug)

  const [program] = await db
    .select()
    .from(loyaltyPrograms)
    .where(eq(loyaltyPrograms.shopId, shop.id))
    .limit(1)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Loyalty Program</CardTitle>
          <CardDescription>
            ลูกค้าสะสมแต้มเมื่อจ่ายเงินสำเร็จ — earn อัตโนมัติเมื่อ mark order paid
            (redeem at checkout จะมาใน P2)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoyaltyForm
            shopSlug={shopSlug}
            defaults={{
              name: program?.name ?? 'Loyalty Points',
              isActive: program?.isActive ?? false,
              earnRateAmount: program?.earnRateAmount ?? '100',
              earnExcludesDiscounts: program?.earnExcludesDiscounts ?? true,
              signupBonusPoints: String(program?.signupBonusPoints ?? 0),
              redeemMinPoints: String(program?.redeemMinPoints ?? 100),
              redeemValuePerPoint: program?.redeemValuePerPoint ?? '0.5',
              redeemStep: String(program?.redeemStep ?? 1),
              redeemMaxPctOfOrder: program?.redeemMaxPctOfOrder ?? '',
              pointsExpiryMonths:
                program?.pointsExpiryMonths !== null && program?.pointsExpiryMonths !== undefined
                  ? String(program.pointsExpiryMonths)
                  : '',
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
