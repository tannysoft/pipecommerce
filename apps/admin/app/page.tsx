import { createServerClient } from '@pipecommerce/auth/admin/server'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import { logout } from './actions.ts'

export default async function AdminHome() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PipeCommerce Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Logged in as <span className="font-mono">{user?.email}</span>
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Logout
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 3c verified</CardTitle>
          <CardDescription>
            Auth flow ทำงาน — middleware gate route, Supabase session refresh, magic link callback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Next: shop creation flow (Phase 3d)
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
