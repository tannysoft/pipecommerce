'use server'

import { AuthError } from 'next-auth'
import { signIn } from '@/auth.ts'

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const next = String(formData.get('next') ?? '/')

  if (!email || !email.includes('@')) {
    return { ok: false, error: 'กรุณากรอกอีเมลที่ถูกต้อง' }
  }

  console.log('[login] sendMagicLink start', {
    email,
    next,
    hasResendKey: !!process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_ADDRESS,
    authUrl: process.env.AUTH_URL,
  })

  try {
    // Auth.js v5 — signIn จะ throw NEXT_REDIRECT เมื่อสำเร็จ (ส่ง email แล้ว
    // redirect ไป verifyRequest page). ต้องปล่อย throw ออกไป — Next.js
    // catch ที่ framework level แล้วทำ redirect ให้
    await signIn('resend', { email, redirectTo: next })
  } catch (error) {
    // NEXT_REDIRECT = สำเร็จ — ปล่อยให้ rethrow
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error
    }
    if (error instanceof AuthError) {
      console.error('[login] AuthError', error.type, error.message, error.cause)
      return { ok: false, error: error.message }
    }
    console.error('[login] unexpected error', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'ส่งลิงก์ไม่สำเร็จ',
    }
  }

  // ไม่ควรมาถึงตรงนี้ — signIn ต้อง redirect เสมอ
  return { ok: true, email }
}
