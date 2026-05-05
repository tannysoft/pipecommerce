/**
 * Storefront font registry — Google Fonts (free) ที่ shop เลือกใช้ได้
 *
 * Approach: load ผ่าน <link> ที่ runtime + display=swap
 *   - ไม่ต้อง pre-bundle ทั้งหมดผ่าน next/font (bundle ใหญ่)
 *   - FOUT มี nidหน่อยแต่ acceptable สำหรับ storefront
 *
 * เลือก curated 18 fonts ครอบคลุม: sans (latin) / sans (thai+latin) /
 *   serif / display
 *
 * default: heading = Noto Sans Thai, body = Inter (รองรับทั้ง EN+TH)
 */

export type FontGroup = 'sans-latin' | 'sans-thai' | 'serif' | 'display'

export type FontDef = {
  key: string
  name: string
  family: string
  group: FontGroup
  weights: string[]
}

export const STOREFRONT_FONTS: FontDef[] = [
  // Sans (Latin) — ใช้กับ heading หรือ body ที่ไม่ต้องการอักษรไทย
  { key: 'inter', name: 'Inter', family: 'Inter', group: 'sans-latin',
    weights: ['400', '500', '600', '700'] },
  { key: 'google-sans', name: 'Google Sans', family: 'Google Sans', group: 'sans-latin',
    weights: ['400', '500', '700'] },
  { key: 'roboto', name: 'Roboto', family: 'Roboto', group: 'sans-latin',
    weights: ['400', '500', '700'] },
  { key: 'manrope', name: 'Manrope', family: 'Manrope', group: 'sans-latin',
    weights: ['400', '500', '600', '700'] },
  { key: 'plus-jakarta-sans', name: 'Plus Jakarta Sans', family: 'Plus Jakarta Sans',
    group: 'sans-latin', weights: ['400', '500', '600', '700'] },
  { key: 'work-sans', name: 'Work Sans', family: 'Work Sans', group: 'sans-latin',
    weights: ['400', '500', '600', '700'] },

  // Sans (Thai + Latin)
  { key: 'noto-sans-thai', name: 'Noto Sans Thai', family: 'Noto Sans Thai',
    group: 'sans-thai', weights: ['400', '500', '600', '700'] },
  { key: 'sarabun', name: 'Sarabun', family: 'Sarabun', group: 'sans-thai',
    weights: ['400', '500', '600', '700'] },
  { key: 'prompt', name: 'Prompt', family: 'Prompt', group: 'sans-thai',
    weights: ['400', '500', '600', '700'] },
  { key: 'kanit', name: 'Kanit', family: 'Kanit', group: 'sans-thai',
    weights: ['400', '500', '600', '700'] },
  { key: 'mitr', name: 'Mitr', family: 'Mitr', group: 'sans-thai',
    weights: ['400', '500', '600', '700'] },
  { key: 'k2d', name: 'K2D', family: 'K2D', group: 'sans-thai',
    weights: ['400', '500', '600', '700'] },
  { key: 'ibm-plex-sans-thai', name: 'IBM Plex Sans Thai',
    family: 'IBM Plex Sans Thai', group: 'sans-thai',
    weights: ['400', '500', '600', '700'] },

  // Serif
  { key: 'playfair-display', name: 'Playfair Display', family: 'Playfair Display',
    group: 'serif', weights: ['400', '500', '700'] },
  { key: 'merriweather', name: 'Merriweather', family: 'Merriweather', group: 'serif',
    weights: ['400', '700'] },
  { key: 'lora', name: 'Lora', family: 'Lora', group: 'serif',
    weights: ['400', '500', '600', '700'] },

  // Display
  { key: 'bebas-neue', name: 'Bebas Neue', family: 'Bebas Neue', group: 'display',
    weights: ['400'] },
  { key: 'oswald', name: 'Oswald', family: 'Oswald', group: 'display',
    weights: ['400', '500', '600', '700'] },
]

const FONT_BY_KEY = new Map(STOREFRONT_FONTS.map((f) => [f.key, f]))
const DEFAULT_HEADING = 'noto-sans-thai'
const DEFAULT_BODY = 'inter'

export function fontStylesheetUrl(font: FontDef): string {
  const family = font.family.replace(/ /g, '+')
  const weights = font.weights.join(';')
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${weights}&display=swap`
}

export function getFontConfig(input?: { heading?: string; body?: string } | null) {
  const headingKey = input?.heading ?? DEFAULT_HEADING
  const bodyKey = input?.body ?? DEFAULT_BODY

  const heading = FONT_BY_KEY.get(headingKey) ?? FONT_BY_KEY.get(DEFAULT_HEADING)!
  const body = FONT_BY_KEY.get(bodyKey) ?? FONT_BY_KEY.get(DEFAULT_BODY)!

  return {
    heading,
    body,
    headingUrl: fontStylesheetUrl(heading),
    bodyUrl: fontStylesheetUrl(body),
  }
}
