import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <Card>
        <CardHeader>
          <CardTitle>Phase 3d verified ✓</CardTitle>
          <CardDescription>
            Shop creation + URL routing ทำงานเรียบร้อย
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            ตอนนี้คุณอยู่ใน <span className="font-mono">/{shopSlug}/dashboard</span> — layout
            verify ว่าคุณเป็น member ของร้าน, ถ้าไม่ใช่ → 404
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            ถัดไป — Phase 3e (storefront middleware shop lookup) หรือ feature CRUD แรก
            (products / collections / customers)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
