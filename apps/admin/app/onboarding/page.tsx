import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pipecommerce/ui'
import { OnboardingForm } from './onboarding-form.tsx'

export const metadata = {
  title: 'สร้างร้านแรก — PipeCommerce',
}

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>สร้างร้านแรกของคุณ</CardTitle>
          <CardDescription>
            ตั้งชื่อร้าน + เลือก URL — เปลี่ยนทีหลังได้เสมอ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </main>
  )
}
