'use server'

import { createServerClient } from '@pipecommerce/auth/admin/server'
import { redirect } from 'next/navigation'

export async function logout() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
