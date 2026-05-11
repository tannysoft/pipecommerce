'use server'

import { and, asc, eq, inArray, isNull } from '@pipecommerce/db'
import { productVariants, products } from '@pipecommerce/db/schema'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db.ts'
import { requireShop } from '@/lib/shop.ts'

export type ImportResult =
  | {
      ok: true
      created: number
      updated: number
      skipped: number
      errors: string[]
    }
  | { ok: false; error: string }

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

/**
 * Parse CSV (RFC 4180 minimal): handle quoted fields, commas, newlines, "" escape
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuote = false
  let i = 0
  const len = text.length

  while (i < len) {
    const ch = text[i]!
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuote = false
        i += 1
        continue
      }
      cell += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inQuote = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      i += 1
      continue
    }
    if (ch === '\r') {
      i += 1
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i += 1
      continue
    }
    cell += ch
    i += 1
  }
  // last cell
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/**
 * Shopify-compat columns (subset):
 *   Handle, Title, Body (HTML), Vendor, Type, Tags, Published,
 *   Variant SKU, Variant Price, Status
 *
 * MVP: 1 product = 1 row (1 variant). Multi-variant import → P2
 */
export async function importProductsCsv(
  shopSlug: string,
  formData: FormData,
): Promise<ImportResult> {
  const { shop } = await requireShop(shopSlug)
  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'no file' }
  if (file.size === 0) return { ok: false, error: 'ไฟล์ว่าง' }
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: 'ไฟล์ใหญ่เกิน 5 MB' }

  const text = await file.text()
  const rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ''))
  if (rows.length < 2) return { ok: false, error: 'CSV ไม่มีข้อมูล (ต้องมี header + อย่างน้อย 1 row)' }

  const header = rows[0]!.map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name.toLowerCase())
  const handleIdx = col('handle')
  const titleIdx = col('title')
  const bodyIdx = col('body (html)')
  const tagsIdx = col('tags')
  const publishedIdx = col('published')
  const skuIdx = col('variant sku')
  const priceIdx = col('variant price')
  const statusIdx = col('status')

  if (titleIdx < 0 || priceIdx < 0) {
    return {
      ok: false,
      error: 'CSV ต้องมีคอลัมน์อย่างน้อย Title + Variant Price',
    }
  }

  let created = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!
    const title = (cells[titleIdx] ?? '').trim()
    if (!title) {
      skipped += 1
      continue
    }
    const handleRaw = (handleIdx >= 0 ? cells[handleIdx] : undefined)?.trim().toLowerCase() ?? ''
    const handle = handleRaw && HANDLE_RE.test(handleRaw) ? handleRaw : slugify(title)
    const body = bodyIdx >= 0 ? (cells[bodyIdx] ?? '').trim() : ''
    const tagsCell = tagsIdx >= 0 ? (cells[tagsIdx] ?? '') : ''
    const tags = tagsCell
      ? Array.from(
          new Set(
            tagsCell
              .split(',')
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean),
          ),
        ).slice(0, 20)
      : []
    const sku = skuIdx >= 0 ? (cells[skuIdx] ?? '').trim() || null : null
    const priceRaw = (cells[priceIdx] ?? '').trim()
    const price = Number(priceRaw)
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`row ${r + 1}: ราคาไม่ถูกต้อง (${priceRaw})`)
      skipped += 1
      continue
    }
    const statusCell = statusIdx >= 0 ? (cells[statusIdx] ?? '').trim().toLowerCase() : ''
    const publishedCell = publishedIdx >= 0 ? (cells[publishedIdx] ?? '').trim().toLowerCase() : ''
    let status: 'draft' | 'active' | 'archived' = 'draft'
    if (statusCell === 'active' || statusCell === 'archived') status = statusCell
    else if (publishedCell === 'true' || publishedCell === '1') status = 'active'

    try {
      const [existing] = await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.shopId, shop.id),
            eq(products.handle, handle),
            isNull(products.deletedAt),
          ),
        )
        .limit(1)

      await db.transaction(async (tx) => {
        if (existing) {
          await tx
            .update(products)
            .set({
              title,
              description: body || null,
              tags,
              status,
              updatedAt: new Date(),
            })
            .where(eq(products.id, existing.id))

          // Update default variant (first variant)
          const [variant] = await tx
            .select({ id: productVariants.id })
            .from(productVariants)
            .where(eq(productVariants.productId, existing.id))
            .orderBy(asc(productVariants.position))
            .limit(1)
          if (variant) {
            await tx
              .update(productVariants)
              .set({ price: price.toFixed(2), sku, updatedAt: new Date() })
              .where(eq(productVariants.id, variant.id))
          }
          updated += 1
        } else {
          const [createdProduct] = await tx
            .insert(products)
            .values({
              shopId: shop.id,
              title,
              handle,
              description: body || null,
              tags,
              status,
            })
            .returning({ id: products.id })
          await tx.insert(productVariants).values({
            productId: createdProduct!.id,
            shopId: shop.id,
            title: 'Default Title',
            price: price.toFixed(2),
            sku,
            position: 0,
          })
          created += 1
        }
      })
    } catch (error) {
      errors.push(`row ${r + 1}: ${(error as Error).message ?? 'unknown error'}`)
      skipped += 1
    }
  }

  revalidatePath(`/${shopSlug}/products`)
  return { ok: true, created, updated, skipped, errors: errors.slice(0, 20) }
}
