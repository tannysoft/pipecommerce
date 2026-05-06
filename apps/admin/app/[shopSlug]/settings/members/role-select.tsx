'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pipecommerce/ui'
import { useTransition } from 'react'
import { changeMemberRole } from './actions.ts'

const ROLES = ['owner', 'admin', 'staff', 'viewer'] as const

export function RoleSelect({
  shopSlug,
  userId,
  currentRole,
}: {
  shopSlug: string
  userId: string
  currentRole: string
}) {
  const [pending, startTransition] = useTransition()

  function onChange(value: string) {
    if (value === currentRole) return
    const formData = new FormData()
    formData.append('role', value)
    startTransition(async () => {
      await changeMemberRole(shopSlug, userId, formData)
    })
  }

  return (
    <Select value={currentRole} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-7 w-28 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {r}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
