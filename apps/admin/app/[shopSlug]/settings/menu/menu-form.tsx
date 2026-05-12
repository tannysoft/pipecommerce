'use client'

import { Button, Input } from '@pipecommerce/ui'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { saveShopMenu } from './actions.ts'

type Item = { label: string; href: string }

const SUGGESTIONS: Item[] = [
  { label: 'สินค้า', href: '/products' },
  { label: 'คอลเลกชัน', href: '/collections' },
  { label: 'บทความ', href: '/blog' },
  { label: 'แกลเลอรี่', href: '/galleries' },
  { label: 'ติดต่อ', href: '/pages/contact' },
]

export function MenuForm({
  shopSlug,
  initialItems,
}: {
  shopSlug: string
  initialItems: Item[]
}) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<
    { ok: true } | { ok: false; error: string } | null
  >(null)
  const dirty = !areItemsEqual(items, initialItems)

  function update(idx: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function remove(idx: number) {
    setItems((arr) => arr.filter((_, i) => i !== idx))
  }
  function move(idx: number, delta: -1 | 1) {
    setItems((arr) => {
      const j = idx + delta
      if (j < 0 || j >= arr.length) return arr
      const next = arr.slice()
      ;[next[idx], next[j]] = [next[j]!, next[idx]!]
      return next
    })
  }
  function add(item?: Item) {
    setItems((arr) => [...arr, item ?? { label: '', href: '' }])
  }

  function onSave() {
    setStatus(null)
    startTransition(async () => {
      const res = await saveShopMenu(shopSlug, items)
      setStatus(res)
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีเมนู — เพิ่มรายการด้านล่าง หรือใช้ตัวอย่างที่แนะนำ
          </p>
        ) : (
          items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-lg border p-3"
            >
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  aria-label="ขึ้น"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0 || pending}
                  className="rounded p-1 hover:bg-accent disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="ลง"
                  onClick={() => move(idx, 1)}
                  disabled={idx === items.length - 1 || pending}
                  className="rounded p-1 hover:bg-accent disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>

              <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_2fr]">
                <Input
                  placeholder="ชื่อ"
                  value={item.label}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  maxLength={40}
                  disabled={pending}
                />
                <Input
                  placeholder="/products หรือ https://..."
                  value={item.href}
                  onChange={(e) => update(idx, { href: e.target.value })}
                  maxLength={200}
                  disabled={pending}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="ลบ"
                onClick={() => remove(idx)}
                disabled={pending}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => add()}
          disabled={pending || items.length >= 12}
        >
          <Plus className="mr-1 size-4" />
          เพิ่มรายการ
        </Button>
        <span className="text-xs text-muted-foreground">
          แนะนำ:
        </span>
        {SUGGESTIONS.filter(
          (s) => !items.some((it) => it.href === s.href),
        ).map((s) => (
          <button
            key={s.href}
            type="button"
            onClick={() => add(s)}
            disabled={pending || items.length >= 12}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            + {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t pt-4">
        <Button type="button" onClick={onSave} disabled={pending || !dirty}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
        {status?.ok ? (
          <span className="text-sm text-emerald-600">บันทึกแล้ว ✓</span>
        ) : null}
        {status && !status.ok ? (
          <span className="text-sm text-destructive">{status.error}</span>
        ) : null}
      </div>
    </div>
  )
}

function areItemsEqual(a: Item[], b: Item[]): boolean {
  if (a.length !== b.length) return false
  return a.every((it, i) => it.label === b[i]!.label && it.href === b[i]!.href)
}
