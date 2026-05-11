'use server'

import { signIn } from '@/auth.ts'

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const next = String(formData.get('next') ?? '/')

  if (!email || !email.includes('@')) {
    return { ok: false, error: 'กรุณากรอกอีเมลที่ถูกต้อง' }
  }

  try {
    await signIn('resend', {
      email,
      redirectTo: next,
      redirect: false,
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'ส่งลิงก์ไม่สำเร็จ',
    }
  }

  return { ok: true, email }
}
