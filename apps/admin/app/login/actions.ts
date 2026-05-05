'use server'

import { createServerClient } from '@pipecommerce/auth/admin/server'
import { headers } from 'next/headers'

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const next = String(formData.get('next') ?? '/')

  if (!email || !email.includes('@')) {
    return { ok: false, error: 'กรุณากรอกอีเมลที่ถูกต้อง' }
  }

  const supabase = await createServerClient()
  const headersList = await headers()
  const origin = headersList.get('origin') ?? `http://${headersList.get('host')}`

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, email }
}
