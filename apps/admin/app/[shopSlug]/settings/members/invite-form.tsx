'use client'

import { Button, Input, Label, Select } from '@pipecommerce/ui'
import { useRef, useState, useTransition } from 'react'
import { inviteMember } from './actions.ts'

const ROLES = [
  { value: 'admin', label: 'Admin — full access' },
  { value: 'staff', label: 'Staff — manage content' },
  { value: 'viewer', label: 'Viewer — read-only' },
]

export function InviteMemberForm({ shopSlug }: { shopSlug: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const res = await inviteMember(shopSlug, formData)
      if (!res.ok) setError(res.error)
      else {
        setSuccess('เพิ่ม member แล้ว ✓')
        formRef.current?.reset()
      }
    })
  }

  return (
    <form ref={formRef} action={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          disabled={pending}
          placeholder="user@example.com"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="role">Role</Label>
        <Select
          id="role"
          name="role"
          defaultValue="staff"
          disabled={pending}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? '...' : '+ Add'}
      </Button>

      {error ? <p className="text-sm text-destructive sm:basis-full">{error}</p> : null}
      {success ? <p className="text-sm text-green-600 sm:basis-full">{success}</p> : null}
    </form>
  )
}
