'use client'

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import {
  assignCustomerToGroup,
  removeCustomerFromGroup,
} from '../groups/actions.ts'

type Membership = {
  groupId: string
  groupName: string
  addedAt: Date
  addedBy: string
}

type Props = {
  shopSlug: string
  customerId: string
  memberships: Membership[]
  availableGroups: Array<{ id: string; name: string }>
}

export function CustomerGroupAssign({
  shopSlug,
  customerId,
  memberships,
  availableGroups,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState('')

  function onAssign() {
    if (!picked) return
    setError(null)
    startTransition(async () => {
      const res = await assignCustomerToGroup(shopSlug, customerId, picked)
      if (!res.ok) setError(res.error)
      else setPicked('')
    })
  }

  function onRemove(groupId: string) {
    setError(null)
    startTransition(async () => {
      const res = await removeCustomerFromGroup(shopSlug, customerId, groupId)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="space-y-3">
      {memberships.length === 0 ? (
        <p className="text-sm text-muted-foreground">ลูกค้ายังไม่อยู่ใน group ใด</p>
      ) : (
        <ul className="space-y-1.5">
          {memberships.map((m) => (
            <li
              key={m.groupId}
              className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-sm"
            >
              <div>
                <span className="font-medium">{m.groupName}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {m.addedBy}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(m.groupId)}
                disabled={pending}
                className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                เอาออก
              </button>
            </li>
          ))}
        </ul>
      )}

      {availableGroups.length > 0 ? (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">เพิ่ม group</p>
          <div className="flex gap-2">
            <Select value={picked} onValueChange={setPicked} disabled={pending}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="เลือก group" />
              </SelectTrigger>
              <SelectContent>
                {availableGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={onAssign} disabled={pending || !picked}>
              {pending ? '...' : 'เพิ่ม'}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
