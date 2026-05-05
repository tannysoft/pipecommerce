# Storefront SEO

> เครื่องมือ + กลไก SEO สำหรับ storefront ของแต่ละร้าน
> Last updated: 2026-05-05

## Goal

ทุกร้านบนแพลตฟอร์มต้องสามารถทำ SEO ได้อย่างสมบูรณ์โดยไม่ต้องเขียน code — sitemap, structured data, meta tags, canonical, redirect ครบในตัว

---

## Scope per phase

| Feature | Phase | Note |
|---|---|---|
| Per-resource SEO fields (title, description, canonical) | **MVP** | มีใน `products.seo_*`, `collections.seo_*` แล้ว |
| Auto sitemap.xml (per shop) | **MVP** | dynamic generation, cache 1 hour |
| robots.txt (configurable per shop) | **MVP** | template + override |
| Open Graph + Twitter card meta | **MVP** | auto-derive จาก SEO fields + first product image |
| Canonical URL handling (subdomain vs custom domain) | **MVP** | บังคับ canonical = primary domain |
| JSON-LD structured data: Product, Organization, BreadcrumbList | **MVP** | ใน theme rendering |
| 301 redirect manager | **MVP** | UI ใน admin + middleware lookup |
| Image alt text enforcement | **MVP** | UI nudge ใน admin |
| JSON-LD: Offer, AggregateRating, Review | P2 | ขึ้นกับ review system |
| FAQPage schema | P2 | ถ้าเปิด FAQ feature |
| hreflang | P2 | ถ้ามี multi-locale |
| Search Console verification helper | P2 | UI ใส่ verification tag |
| Page speed insights ใน admin | P2 | integrate Lighthouse / CrUX |
| Internal linking suggestions | P2 | ML-based |
| AI-generated meta suggestions | P3 | |
| A/B test meta titles | P3 | |
| Schema testing tool | P3 | |

---

## URL Structure

ใช้ pattern เดียวกับ Shopify ที่ proven แล้ว — สั้น, มี keyword, มี handle

```
/                                         home
/products/{handle}                        product detail
/collections/{handle}                     collection
/collections/{handle}/products/{handle}   product within collection (canonical = /products/{handle})
/cart                                     cart
/search?q=...                             search
/blog                                     article list (paginated)
/blog/{handle}                            article detail
/pages/{handle}                           static page (about, FAQ, ...)
```

**ห้าม:**
- ID ใน URL (`/products/abc-123-uuid`) — ใช้ handle เท่านั้น
- query string สำหรับ filter ที่ index ได้ — ใช้ path-based filter หรือ noindex

---

## Canonical URL Strategy

ปัญหา: 1 ร้านมีได้หลาย hostname (default subdomain + custom domain + www variants) → Google เห็นเป็น duplicate

**Rule:**

1. ทุกร้านมี **primary domain** ใน `shop_domains.is_primary = true`
2. Storefront ต้อง emit `<link rel="canonical">` ชี้ไป primary domain เสมอ
3. Non-primary domains → 301 redirect ไป primary (ทำใน middleware)

```ts
// apps/storefront/middleware.ts
const shop = await lookupShopByHost(host)
if (shop.primary_domain && host !== shop.primary_domain) {
  const url = new URL(req.url)
  url.host = shop.primary_domain
  return NextResponse.redirect(url, 301)
}
```

**Exception:** ตอน editor preview ผ่าน iframe → ไม่ redirect (detect via `?theme_draft=` param)

---

## Sitemap

### Endpoint

```
{shop-domain}/sitemap.xml         → sitemap index
{shop-domain}/sitemap-products.xml
{shop-domain}/sitemap-collections.xml
{shop-domain}/sitemap-articles.xml
{shop-domain}/sitemap-pages.xml
```

แตกเป็น sub-sitemap เพราะ Google จำกัด 50K URLs / 50MB ต่อไฟล์

### Implementation

```ts
// apps/storefront/app/sitemap.xml/route.ts
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const shop = await getShopFromHost(req)
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${shop.url}/sitemap-products.xml</loc></sitemap>
  <sitemap><loc>${shop.url}/sitemap-collections.xml</loc></sitemap>
  <sitemap><loc>${shop.url}/sitemap-pages.xml</loc></sitemap>
</sitemapindex>`
  
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
```

### Per-resource sitemap

```ts
// apps/storefront/app/sitemap-products.xml/route.ts
const products = await db.query.products.findMany({
  where: and(
    eq(products.shopId, shop.id),
    eq(products.status, 'active'),
  ),
  columns: { handle: true, updatedAt: true },
  with: { primaryImage: true },
})

const urls = products.map(p => `
  <url>
    <loc>${shop.url}/products/${p.handle}</loc>
    <lastmod>${p.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <image:image>
      <image:loc>${imageUrl(p.primaryImage, 'high')}</image:loc>
      <image:title>${escape(p.title)}</image:title>
    </image:image>
  </url>
`).join('')

return xml(`<urlset xmlns="..." xmlns:image="...">${urls}</urlset>`)
```

### Sitemap pagination

ถ้า products > 40K → split เป็น `sitemap-products-1.xml`, `sitemap-products-2.xml`, ...

### Cache

- Cloudflare cache 1 hour
- Invalidate manually เมื่อ bulk product import
- Auto-invalidate ผ่าน revalidate-tag เมื่อ product publish/unpublish

---

## robots.txt

### Default

```
User-agent: *
Allow: /
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /search
Disallow: /api/

Sitemap: {shop-url}/sitemap.xml
```

### Per-shop override

ใน admin → Settings → SEO → robots.txt (textarea ตัว full text)
- เก็บใน `shops.settings.robots_txt`
- ถ้าไม่ตั้ง = ใช้ default
- Validation: warn ถ้า user เผลอใส่ `Disallow: /` (block ทั้งร้าน)

---

## Meta Tags

### Per-page rendering

ทุก theme **ต้อง** render meta tags ใน `<head>` ตาม convention:

```tsx
// packages/themes/shared/seo/MetaTags.tsx
export function MetaTags({ title, description, canonical, ogImage, type = 'website' }) {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonical} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </>
  )
}
```

### Auto-derive logic

ถ้า user ไม่กรอก SEO field → auto-generate:

| Field | Auto-derive |
|---|---|
| `seo_title` | `{product.title} - {shop.name}` |
| `seo_description` | strip HTML จาก `description`, ตัด 160 ตัว |
| OG image | first product image (variant `high`) หรือ shop logo ถ้าไม่มีรูป |
| canonical | primary domain + path |

### Meta length validation (UI nudge)

ใน admin form:
- Title: warn ถ้า > 60 ตัว (truncate ใน SERP)
- Description: warn ถ้า > 160 ตัว
- Show preview เหมือน Google SERP

---

## Structured Data (JSON-LD)

ทุก theme ต้อง emit JSON-LD ตาม pattern:

### Product page

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "...",
  "description": "...",
  "image": ["...high.webp", "..."],
  "sku": "...",
  "brand": { "@type": "Brand", "name": "..." },
  "offers": {
    "@type": "Offer",
    "url": "{canonical}",
    "priceCurrency": "THB",
    "price": "...",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "seller": { "@type": "Organization", "name": "{shop.name}" }
  },
  "aggregateRating": { ... }   // [P2] เมื่อมี review system
}
```

### Variant handling

ถ้ามีหลาย variant → ใช้ `Product` หลัก + `hasVariant` array หรือ emit `ProductGroup` schema

### Collection page

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "url": "..." },
    ...
  ]
}
```

### Breadcrumb

ทุกหน้า detail → emit `BreadcrumbList`

```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "..." },
    { "@type": "ListItem", "position": 2, "name": "Collection", "item": "..." },
    { "@type": "ListItem", "position": 3, "name": "Product Title", "item": "..." }
  ]
}
```

### Article page (BlogPosting)

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "...",
  "description": "...",
  "image": ["...high.webp"],
  "datePublished": "...",
  "dateModified": "...",
  "author": { "@type": "Person", "name": "..." },
  "publisher": {
    "@type": "Organization",
    "name": "{shop.name}",
    "logo": { "@type": "ImageObject", "url": "..." }
  },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "{canonical}" }
}
```

### Static page (WebPage)

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "...",
  "description": "...",
  "url": "{canonical}"
}
```

### Organization (home page)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "{shop.name}",
  "url": "{shop.url}",
  "logo": "...",
  "sameAs": ["{shop.facebook_url}", "{shop.instagram_url}", ...]
}
```

### WebSite + Sitelinks Searchbox (home page)

```json
{
  "@type": "WebSite",
  "url": "{shop.url}",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "{shop.url}/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

---

## 301 Redirect Manager

### Use case
- ร้านเปลี่ยน product handle → ไม่อยากให้ link เก่าเสีย
- Migrate มาจากเว็บเก่า → preserve ranking ของ URL เดิม
- Discontinued product → redirect ไป collection

### Schema

```sql
seo_redirects (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  from_path       text NOT NULL,           -- '/products/old-handle' หรือ glob '/old/*'
  to_path         text NOT NULL,           -- '/products/new-handle'
  type            int NOT NULL DEFAULT 301, -- 301 | 302
  is_active       boolean DEFAULT true,
  hits_count      int DEFAULT 0,
  last_hit_at     timestamptz,
  created_at, updated_at,
  UNIQUE (shop_id, from_path)
)
CREATE INDEX ON seo_redirects(shop_id, is_active);
```

### Auto-redirect

เมื่อ user เปลี่ยน `products.handle` → ระบบสร้าง row ใน `seo_redirects` อัตโนมัติ (จาก old → new)

### Middleware lookup

```ts
// apps/storefront/middleware.ts
const redirect = await lookupRedirect(shop.id, url.pathname)  // KV cache
if (redirect) {
  return NextResponse.redirect(`${url.origin}${redirect.to_path}`, redirect.type)
}
```

---

## Performance + Core Web Vitals

SEO modern = Core Web Vitals (LCP, INP, CLS) เป็น ranking factor

**Built-in optimizations ทุก theme ต้องผ่าน:**
- รูป hero ใส่ `priority` + `fetchpriority="high"` + preload
- Image variants (low/mid/high) + `srcset` ครบ
- Font: `display: swap` + preload critical fonts
- ห้าม CSS-in-JS runtime (Tailwind compile-time เท่านั้น)
- ห้าม layout shift จาก image — `width`/`height` เสมอ
- ISR + Cloudflare edge cache → TTFB ต่ำ

**CI check:** Lighthouse CI ใน GitHub Actions ทุก PR ที่แตะ theme — fail ถ้า score < 90

---

## Admin SEO Tools

### Page-level
- Edit SEO title, description, canonical, social image
- Preview SERP snippet
- Preview Open Graph card (Facebook, Twitter, LINE)
- Length warning

### Site-level (Settings → SEO)
- robots.txt editor
- Verification meta tags (Google Search Console, Bing Webmaster)
- Default OG image
- Default meta title pattern (e.g., `{page} - {shop.name}`)

### Audit `[P2]`
- Pages without meta description
- Pages without OG image
- Images without alt text
- Broken redirects (target 404)
- Duplicate meta titles

---

## Schema additions

```sql
-- เพิ่มใน shops.settings (jsonb):
-- {
--   "seo": {
--     "robots_txt": "...",
--     "default_og_image_asset_id": "...",
--     "title_pattern": "{page} - {shop_name}",
--     "google_verification": "...",
--     "bing_verification": "..."
--   }
-- }

-- ตารางใหม่: seo_redirects (ดูด้านบน)
```

---

## Out of scope (อาจกลับมาคิดทีหลัง)

- AMP pages — Google ไม่สำคัญแล้วในปี 2025+
- HTML sitemap (footer) — JSON-LD/XML เพียงพอ
- Multi-currency hreflang — ใส่ใน P2 เมื่อเปิด multi-locale
- LinkedIn / Pinterest meta — ส่วนใหญ่ใช้ OG อยู่แล้ว
