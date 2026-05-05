import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import { LoginForm } from './login-form.tsx'

export const metadata = {
  title: 'เข้าสู่ระบบ — PipeCommerce Admin',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">เข้าสู่ระบบ</CardTitle>
          <CardDescription>
            กรอกอีเมล — เราจะส่งลิงก์เข้าใช้งานให้ทันที (ไม่ต้องตั้งรหัสผ่าน)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next ?? '/'} />
        </CardContent>
      </Card>
    </main>
  )
}
