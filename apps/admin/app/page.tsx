import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">PipeCommerce Admin</h1>
        <p className="mt-2 text-muted-foreground">
          Skeleton — see <code>docs/</code> for architecture.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>UI smoke test</CardTitle>
          <CardDescription>
            ถ้าเห็น card + button styled ตามภาพ = packages/ui ทำงานถูกต้อง
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </CardContent>
      </Card>
    </main>
  )
}
