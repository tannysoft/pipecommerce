'use client'

import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * ColorPicker — swatch trigger + popover with preset palette + custom input
 *
 * Value: CSS color string (hex / rgb / oklch / named) หรือ '' = ไม่ตั้ง
 * Returns: value or '' via onChange
 *
 * UX:
 *   - Click swatch → popover
 *   - Preset palette: click → set + close
 *   - Custom: native <input type=color> + hex text input
 *   - 'ล้าง' → set ''
 *   - Outside click / Esc → close
 */

const PRESET_PALETTE: string[] = [
  // Neutrals
  '#000000', '#1f2937', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#f3f4f6', '#ffffff',
  // Brand-y
  '#dc2626', '#ea580c', '#d97706', '#16a34a', '#0d9488', '#0284c7', '#4f46e5', '#9333ea',
  // Soft
  '#fee2e2', '#ffedd5', '#fef3c7', '#dcfce7', '#ccfbf1', '#dbeafe', '#e0e7ff', '#fae8ff',
]

function normalizeHex(input: string): string | null {
  let s = input.trim()
  if (!s) return null
  if (!s.startsWith('#')) s = `#${s}`
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    return `#${s[1]!}${s[1]!}${s[2]!}${s[2]!}${s[3]!}${s[3]!}`.toLowerCase()
  }
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase()
  return null
}

export type ColorPickerProps = {
  value: string | null
  onChange: (value: string) => void
  /** Allow clearing (empty value) */
  allowClear?: boolean
  /** Custom presets (ถ้าไม่ใส่ใช้ default 24 สี) */
  presets?: string[]
  /** Placeholder ตอนยังไม่เลือก */
  placeholder?: string
  disabled?: boolean
  /** Hex input placeholder */
  inputPlaceholder?: string
  className?: string
  id?: string
  'aria-label'?: string
}

export function ColorPicker({
  value,
  onChange,
  allowClear = true,
  presets = PRESET_PALETTE,
  placeholder = 'เลือกสี',
  disabled,
  inputPlaceholder = '#000000',
  className,
  id,
  'aria-label': ariaLabel,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const display = value && value.trim() ? value : ''

  function selectPreset(color: string) {
    onChange(color)
    setDraft(color)
    setOpen(false)
  }

  function commitDraft() {
    const normalized = normalizeHex(draft)
    if (normalized) {
      onChange(normalized)
      setDraft(normalized)
    } else if (draft.trim() === '') {
      if (allowClear) onChange('')
    } else {
      // Non-hex CSS value (oklch, rgb, named) — pass through as-is
      onChange(draft.trim())
    }
  }

  return (
    <div ref={ref} className={`relative inline-block w-full ${className ?? ''}`}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel ?? placeholder}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center gap-2 rounded-md border bg-background px-2 text-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Swatch color={display} />
        <span className={`flex-1 truncate text-left ${display ? '' : 'text-muted-foreground'}`}>
          {display || placeholder}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg duration-150 animate-in fade-in-0 slide-in-from-top-1"
        >
          <div className="grid grid-cols-8 gap-1.5">
            {presets.map((c) => {
              const isActive = c.toLowerCase() === display.toLowerCase()
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => selectPreset(c)}
                  className="group relative flex aspect-square items-center justify-center rounded border transition hover:scale-110"
                  style={{ backgroundColor: c }}
                >
                  {isActive ? (
                    <Check
                      className={`size-3.5 ${isLightColor(c) ? 'text-black' : 'text-white'}`}
                    />
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="mt-3 space-y-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={normalizeHex(draft) ?? '#000000'}
                onChange={(e) => {
                  setDraft(e.target.value)
                  onChange(e.target.value)
                }}
                className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                aria-label="เลือกสีแบบกำหนดเอง"
              />
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitDraft()
                  }
                }}
                placeholder={inputPlaceholder}
                spellCheck={false}
                className="h-9 flex-1 rounded-md border bg-background px-2 text-sm font-mono"
              />
            </div>
            {allowClear && display ? (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setDraft('')
                  setOpen(false)
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" /> ล้างสี
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Swatch({ color }: { color: string }) {
  if (!color) {
    return (
      <span
        aria-hidden
        className="size-6 shrink-0 rounded border"
        style={{
          backgroundImage:
            'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
        }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="size-6 shrink-0 rounded border"
      style={{ backgroundColor: color }}
    />
  )
}

/**
 * Rough lightness check สำหรับ choose check-mark color
 */
function isLightColor(hex: string): boolean {
  const n = normalizeHex(hex)
  if (!n) return false
  const r = parseInt(n.slice(1, 3), 16)
  const g = parseInt(n.slice(3, 5), 16)
  const b = parseInt(n.slice(5, 7), 16)
  // YIQ luminance
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}
