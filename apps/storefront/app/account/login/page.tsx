import { redirect } from 'next/navigation'
import { getCustomer } from '@/lib/customer-session.ts'
import { CustomerLoginForm } from './login-form.tsx'

export const metadata = { title: 'เข้าสู่ระบบ' }

export default async function CustomerLoginPage() {
  const customer = await getCustomer()
  if (customer) redirect('/account')

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold">เข้าสู่ระบบ</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          กรอกอีเมลเพื่อรับลิงก์เข้าสู่ระบบ
        </p>
      </header>
      <CustomerLoginForm />
    </main>
  )
}
