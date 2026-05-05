/**
 * Mirror ของ STOREFRONT_FONTS ใน apps/storefront/lib/fonts.ts
 *
 * Admin ใช้แค่ list (key + name + group) สำหรับ dropdown
 * — ไม่ต้องโหลด stylesheet ที่ admin
 *
 * ⚠ ต้อง keep ตรงกับ apps/storefront/lib/fonts.ts STOREFRONT_FONTS
 *   (Phase ถัดไปย้ายเป็น packages/themes/fonts ถ้าเริ่ม drift)
 */

export type FontGroup = 'sans-latin' | 'sans-thai' | 'serif' | 'display'

export type AdminFontDef = {
  key: string
  name: string
  group: FontGroup
}

export const ADMIN_FONT_OPTIONS: AdminFontDef[] = [
  { key: 'inter', name: 'Inter', group: 'sans-latin' },
  { key: 'google-sans', name: 'Google Sans', group: 'sans-latin' },
  { key: 'roboto', name: 'Roboto', group: 'sans-latin' },
  { key: 'manrope', name: 'Manrope', group: 'sans-latin' },
  { key: 'plus-jakarta-sans', name: 'Plus Jakarta Sans', group: 'sans-latin' },
  { key: 'work-sans', name: 'Work Sans', group: 'sans-latin' },
  { key: 'noto-sans-thai', name: 'Noto Sans Thai', group: 'sans-thai' },
  { key: 'sarabun', name: 'Sarabun', group: 'sans-thai' },
  { key: 'prompt', name: 'Prompt', group: 'sans-thai' },
  { key: 'kanit', name: 'Kanit', group: 'sans-thai' },
  { key: 'mitr', name: 'Mitr', group: 'sans-thai' },
  { key: 'k2d', name: 'K2D', group: 'sans-thai' },
  { key: 'ibm-plex-sans-thai', name: 'IBM Plex Sans Thai', group: 'sans-thai' },
  { key: 'playfair-display', name: 'Playfair Display', group: 'serif' },
  { key: 'merriweather', name: 'Merriweather', group: 'serif' },
  { key: 'lora', name: 'Lora', group: 'serif' },
  { key: 'bebas-neue', name: 'Bebas Neue', group: 'display' },
  { key: 'oswald', name: 'Oswald', group: 'display' },
]

const GROUP_LABEL: Record<FontGroup, string> = {
  'sans-thai': 'Sans (รองรับไทย)',
  'sans-latin': 'Sans (Latin)',
  serif: 'Serif',
  display: 'Display',
}

export const ADMIN_FONT_KEYS = new Set(ADMIN_FONT_OPTIONS.map((f) => f.key))

export function adminFontGroupLabel(group: FontGroup): string {
  return GROUP_LABEL[group]
}

export function groupedFontOptions(): { group: FontGroup; label: string; options: AdminFontDef[] }[] {
  const groups: FontGroup[] = ['sans-thai', 'sans-latin', 'serif', 'display']
  return groups.map((g) => ({
    group: g,
    label: GROUP_LABEL[g],
    options: ADMIN_FONT_OPTIONS.filter((f) => f.group === g),
  }))
}
