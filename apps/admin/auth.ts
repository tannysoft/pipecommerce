import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { accounts, sessions, users, verificationTokens } from '@pipecommerce/db/schema'
import NextAuth from 'next-auth'
import Resend from 'next-auth/providers/resend'
import { db } from '@/lib/db.ts'

/**
 * Auth.js v5 — แทน Supabase Auth สำหรับ admin user authentication
 *
 * Flow: magic link via Resend
 *   1. user กรอก email ที่ /login
 *   2. NextAuth ส่ง email มี magic link ผ่าน Resend
 *   3. user คลิก → /api/auth/callback/resend?token=... → set session cookie
 *   4. session อ่านได้ผ่าน `auth()` ใน server component / action / route handler
 *
 * Drizzle adapter ใช้ users + accounts + sessions + verification_tokens tables
 * ใน apps/admin/app/api/auth/[...nextauth]/route.ts จะ export handlers
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM_ADDRESS ?? 'noreply@pipecommerce.local',
    }),
  ],
  session: {
    strategy: 'database',
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?check-email',
    error: '/login',
  },
  callbacks: {
    async session({ session, user }) {
      // Expose user.id ใน session object
      if (session.user && user) {
        session.user.id = user.id
      }
      return session
    },
  },
  trustHost: true, // CF / Railway proxy
})
