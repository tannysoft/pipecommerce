import { sql } from '@pipecommerce/db'
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pipecommerce/ui'
import Link from 'next/link'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { removeMember } from './actions.ts'
import { InviteMemberForm } from './invite-form.tsx'
import { RoleSelect } from './role-select.tsx'

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  staff: 'bg-gray-100 text-gray-700',
  viewer: 'bg-yellow-100 text-yellow-700',
}

function initials(email: string | null): string {
  if (!email) return '?'
  const local = email.split('@')[0] ?? ''
  return local.slice(0, 2).toUpperCase()
}

export default async function MembersPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const { shop, user: currentUser } = await requireShop(shopSlug)

  const memberRows = await db.execute<{
    user_id: string
    email: string | null
    role: string
    accepted_at: string | null
  }>(sql`
    SELECT
      sm.user_id::text as user_id,
      u.email,
      sm.role,
      sm.accepted_at
    FROM shop_members sm
    LEFT JOIN auth.users u ON u.id = sm.user_id
    WHERE sm.shop_id = ${shop.id}
    ORDER BY sm.role, u.email
  `)
  const members = memberRows as unknown as {
    user_id: string
    email: string | null
    role: string
    accepted_at: string | null
  }[]

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href={`/${shopSlug}/settings`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Settings
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>เพิ่ม Member</CardTitle>
          <CardDescription>
            ใส่ email ของคนที่มี account อยู่แล้ว — ถ้ายังไม่ลงทะเบียน ให้ login ที่ /login ก่อน
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteMemberForm shopSlug={shopSlug} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members ปัจจุบัน ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {members.map((m) => {
              const isMe = m.user_id === currentUser.id
              return (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Avatar>
                    <AvatarFallback>{initials(m.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {m.email ?? <span className="text-muted-foreground">—</span>}
                      {isMe ? (
                        <span className="ml-2 text-xs text-muted-foreground">(คุณ)</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isMe ? (
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${ROLE_BADGE[m.role] ?? ROLE_BADGE.staff}`}
                      >
                        {m.role}
                      </span>
                    ) : (
                      <RoleSelect
                        shopSlug={shopSlug}
                        userId={m.user_id}
                        currentRole={m.role}
                      />
                    )}
                    {!isMe ? (
                      <form action={removeMember.bind(null, shopSlug, m.user_id)}>
                        <Button type="submit" variant="outline" size="sm">
                          Remove
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ⚠ ตอนนี้ทุก role เข้าถึงได้เท่ากัน — role-based permission gate ทำในเฟสถัดไป
      </p>
    </div>
  )
}
