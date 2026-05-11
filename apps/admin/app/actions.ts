'use server'

import { signOut } from '@/auth.ts'

export async function logout() {
  await signOut({ redirectTo: '/login' })
}
