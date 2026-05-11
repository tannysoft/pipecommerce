/**
 * Home page section types — JSON-serializable, stored in shopThemeSettings.templates.home.sections
 *
 * Adding a new type:
 *   1. Add discriminated union case ที่นี่
 *   2. Add default settings ใน DEFAULT_SECTION_SETTINGS
 *   3. Add renderer ใน apps/storefront/app/_sections/<type>.tsx
 *   4. Add settings form ใน apps/admin/app/[shopSlug]/theme/home/section-form.tsx
 */

export type HeroSection = {
  id: string
  type: 'hero'
  settings: {
    headline?: string
    subheadline?: string
    ctaText?: string
    ctaUrl?: string
    imageUrl?: string
    backgroundColor?: string
    textColor?: string
    align?: 'left' | 'center'
  }
}

export type FeaturedProductsSection = {
  id: string
  type: 'featuredProducts'
  settings: {
    headline?: string
    productHandles?: string[] // pick by handle
    limit?: number // fallback ถ้าไม่ได้เลือก
  }
}

export type FeaturedCollectionsSection = {
  id: string
  type: 'featuredCollections'
  settings: {
    headline?: string
    collectionHandles?: string[]
  }
}

export type TextBlockSection = {
  id: string
  type: 'textBlock'
  settings: {
    headline?: string
    body?: string
    align?: 'left' | 'center'
  }
}

export type ImageBannerSection = {
  id: string
  type: 'imageBanner'
  settings: {
    imageUrl?: string
    link?: string
    altText?: string
    height?: 'sm' | 'md' | 'lg'
  }
}

export type Section =
  | HeroSection
  | FeaturedProductsSection
  | FeaturedCollectionsSection
  | TextBlockSection
  | ImageBannerSection

export type SectionType = Section['type']

export type HomeTemplate = {
  sections: Section[]
}

export const SECTION_LIBRARY: Array<{
  type: SectionType
  label: string
  description: string
}> = [
  { type: 'hero', label: 'Hero', description: 'แบนเนอร์หลัก + headline + ปุ่ม CTA' },
  { type: 'featuredProducts', label: 'สินค้าแนะนำ', description: 'รายการสินค้าที่เลือก' },
  {
    type: 'featuredCollections',
    label: 'Collections แนะนำ',
    description: 'หมวดหมู่ที่เลือก',
  },
  { type: 'textBlock', label: 'Text block', description: 'หัวข้อ + ข้อความ' },
  { type: 'imageBanner', label: 'Image banner', description: 'รูปภาพเต็มหน้า' },
]

export function defaultSectionSettings(type: SectionType): Section['settings'] {
  switch (type) {
    case 'hero':
      return {
        headline: 'ยินดีต้อนรับสู่ร้านของเรา',
        subheadline: 'สินค้าคุณภาพ คัดสรรพิเศษเพื่อคุณ',
        ctaText: 'ดูสินค้า',
        ctaUrl: '/products',
        align: 'center',
      }
    case 'featuredProducts':
      return { headline: 'สินค้าแนะนำ', limit: 8, productHandles: [] }
    case 'featuredCollections':
      return { headline: 'Collections', collectionHandles: [] }
    case 'textBlock':
      return { headline: 'เกี่ยวกับเรา', body: '', align: 'center' }
    case 'imageBanner':
      return { height: 'md' }
  }
}

export function defaultHomeTemplate(): HomeTemplate {
  return {
    sections: [
      {
        id: 'sect-hero',
        type: 'hero',
        settings: defaultSectionSettings('hero') as HeroSection['settings'],
      },
      {
        id: 'sect-products',
        type: 'featuredProducts',
        settings: defaultSectionSettings(
          'featuredProducts',
        ) as FeaturedProductsSection['settings'],
      },
    ],
  }
}

export function newSectionId(): string {
  return `sect-${crypto.randomUUID().slice(0, 8)}`
}
