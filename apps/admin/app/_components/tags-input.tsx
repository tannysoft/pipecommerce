'use client'

import { Input } from '@pipecommerce/ui'
import { useState } from 'react'

type Props = {
  value: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
  placeholder?: string
  max?: number
}

function normalize(s: string) {
  return s.trim().toLowerCase()
}

export function TagsInput({
  value,
  onChange,
  disabled,
  placeholder = 'พิมพ์แล้วกด Enter หรือคั่นด้วย ,',
  max = 20,
}: Props) {
  const [draft, setDraft] = useState('')

  function commit(raw: string) {
    const parts = raw
      .split(',')
      .map(normalize)
      .filter(Boolean)
    if (parts.length === 0) return
    const next = [...value]
    for (const tag of parts) {
      if (next.length >= max) break
      if (!next.includes(tag)) next.push(tag)
    }
    onChange(next)
    setDraft('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    if (text.includes(',')) {
      e.preventDefault()
      commit(draft + text)
    }
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            disabled={disabled}
            className="leading-none text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label={`ลบ tag ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => draft && commit(draft)}
        disabled={disabled || value.length >= max}
        placeholder={value.length === 0 ? placeholder : ''}
        className="h-6 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
      />
    </div>
  )
}
