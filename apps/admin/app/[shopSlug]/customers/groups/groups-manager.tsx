'use client'

import { Button, Input, Label } from '@pipecommerce/ui'
import { useState, useTransition } from 'react'
import { ConfirmDialog } from '../../../_components/confirm-dialog.tsx'
import { createGroup, deleteGroup, updateGroup } from './actions.ts'

type Group = {
  id: string
  name: string
  description: string | null
  type: string
  memberCount: number
}

type Props = {
  shopSlug: string
  groups: Group[]
}

export function GroupsManager({ shopSlug, groups }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('description', description)
      const res = await createGroup(shopSlug, fd)
      if (!res.ok) {
        setError(res.error)
      } else {
        setName('')
        setDescription('')
      }
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onCreate} className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">+ สร้าง Group ใหม่</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr_auto]">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น VIP, Wholesale"
            disabled={pending}
            required
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="คำอธิบาย (optional)"
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? '...' : 'สร้าง'}
          </Button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </form>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มี group</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {groups.map((g) => (
            <GroupRow key={g.id} shopSlug={shopSlug} group={g} pending={pending} />
          ))}
        </ul>
      )}
    </div>
  )
}

function GroupRow({
  shopSlug,
  group,
  pending: parentPending,
}: {
  shopSlug: string
  group: Group
  pending: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [error, setError] = useState<string | null>(null)

  function onSave() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('description', description)
      const res = await updateGroup(shopSlug, group.id, fd)
      if (!res.ok) setError(res.error)
      else setEditing(false)
    })
  }

  function onDelete() {
    startDelete(async () => {
      await deleteGroup(shopSlug, group.id)
    })
  }

  const disabled = pending || parentPending || deletePending

  if (editing) {
    return (
      <li className="space-y-2 px-3 py-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">ชื่อ</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">คำอธิบาย</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={disabled}>
            {pending ? '...' : 'บันทึก'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(false)
              setName(group.name)
              setDescription(group.description ?? '')
            }}
            disabled={disabled}
          >
            ยกเลิก
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between px-3 py-3">
      <div className="min-w-0">
        <p className="font-medium">{group.name}</p>
        {group.description ? (
          <p className="text-xs text-muted-foreground">{group.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {group.memberCount} สมาชิก · {group.type}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={disabled}>
          แก้ไข
        </Button>
        <ConfirmDialog
          title={`ลบ group "${group.name}"?`}
          description="ลบกลุ่มนี้ — สมาชิกจะถูก unlink (customer record ยังอยู่)"
          confirmLabel="ลบ"
          pending={deletePending}
          onConfirm={onDelete}
        >
          <Button size="sm" variant="destructive" disabled={disabled}>
            ลบ
          </Button>
        </ConfirmDialog>
      </div>
    </li>
  )
}
