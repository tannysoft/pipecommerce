'use client'

import { Button } from '@pipecommerce/ui'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { deleteAddress } from './actions.ts'
import { AddressForm } from './address-form.tsx'

type Address = {
  id: string
  label: string | null
  recipientName: string
  phone: string | null
  line1: string
  line2: string | null
  subdistrict: string | null
  district: string | null
  province: string
  postalCode: string
  isDefault: boolean
}

export function AddressesList({ addresses }: { addresses: Address[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pending, startTransition] = useTransition()

  function onDelete(id: string) {
    if (!confirm('ลบที่อยู่นี้?')) return
    startTransition(async () => {
      await deleteAddress(id)
    })
  }

  if (creating) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium">เพิ่มที่อยู่ใหม่</h3>
        <AddressForm
          onSaved={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {addresses.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          ยังไม่มีที่อยู่ — เพิ่มเพื่อให้ checkout เร็วขึ้น
        </p>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-lg border p-4">
              {editingId === a.id ? (
                <AddressForm
                  initial={a}
                  onSaved={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      {a.label ? (
                        <span className="font-medium">{a.label}</span>
                      ) : null}
                      {a.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <Star className="size-3 fill-current" /> หลัก
                        </span>
                      ) : null}
                    </div>
                    <p className="font-medium">{a.recipientName}</p>
                    {a.phone ? (
                      <p className="text-muted-foreground">{a.phone}</p>
                    ) : null}
                    <p className="text-muted-foreground">
                      {a.line1}
                      {a.line2 ? ` ${a.line2}` : ''}
                    </p>
                    <p className="text-muted-foreground">
                      {[a.subdistrict, a.district, a.province, a.postalCode]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingId(a.id)}
                      aria-label="แก้ไข"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(a.id)}
                      disabled={pending}
                      aria-label="ลบ"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" onClick={() => setCreating(true)}>
        <Plus className="mr-1 size-4" /> เพิ่มที่อยู่
      </Button>
    </div>
  )
}
