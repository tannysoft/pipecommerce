import { eq } from '@pipecommerce/db'
import { shopThemeSettings, themes } from '@pipecommerce/db/schema'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'
import { defaultHomeTemplate } from './sections.ts'

/**
 * Lazy-init shop_theme_settings + ensure ≥ 1 active theme (auto-seed 'minimal'
 * ถ้า DB ยังว่าง — กัน setup friction)
 *
 * แยกจาก actions.ts (ที่เป็น 'use server') เพราะ data-fetch ใน server component
 * ควรเป็น regular async function ไม่ใช่ server action RPC
 */
export async function getOrInitTheme(shopSlug: string) {
  const { shop } = await requireShop(shopSlug)
  const shopId = shop.id

  const [existing] = await db
    .select()
    .from(shopThemeSettings)
    .where(eq(shopThemeSettings.shopId, shopId))
    .limit(1)
  if (existing) return existing

  let theme = (
    await db
      .select({
        id: themes.id,
        code: themes.code,
        version: themes.version,
      })
      .from(themes)
      .where(eq(themes.isActive, true))
      .limit(1)
  )[0]

  if (!theme) {
    const [created] = await db
      .insert(themes)
      .values({
        code: 'minimal',
        name: 'Minimal',
        description: 'Default minimal theme — clean + simple',
        category: 'general',
        version: '1.0.0',
        schema: {
          sections: [
            'hero',
            'featuredProducts',
            'featuredCollections',
            'textBlock',
            'imageBanner',
          ],
        },
        isActive: true,
        releasedAt: new Date(),
      })
      .returning({ id: themes.id, code: themes.code, version: themes.version })
    theme = created!
  }

  const initialTemplates = { home: defaultHomeTemplate() }
  const [created] = await db
    .insert(shopThemeSettings)
    .values({
      shopId,
      themeId: theme.id,
      themeCode: theme.code,
      themeVersion: theme.version,
      settings: {},
      templates: initialTemplates,
    })
    .returning()
  return created!
}
