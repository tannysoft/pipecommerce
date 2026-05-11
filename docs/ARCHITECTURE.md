# Architecture

> Last updated: 2026-05-11
> Status: MVP implementation phase. Migrated off Cloudflare Workers → Railway
> in 2026-05 (see [DECISIONS.md](DECISIONS.md) ADR-2026-05-11).

## Vision

PipeCommerce เป็น SaaS e-commerce platform แบบ Shopify-like สำหรับตลาดไทย เน้น:

- ร้านค้าสร้างเว็บไซต์ของตัวเองได้ภายในนาที
- ลูกค้าสามารถจด domain เองและชี้ CNAME มาที่แพลตฟอร์ม
- ระบบคูปอง / ส่วนลดที่ flexible
- รองรับการชำระเงินผ่าน Beamcheckout (รวม PromptPay, บัตรเครดิต)
- ระบบ CRM + สะสมแต้ม (loyalty program) ในตัว

---

## Tech Stack (Final)

| Layer | Tool | หมายเหตุ |
|---|---|---|
| Framework | **Next.js 16** (App Router) | RSC, ISR, Node runtime |
| Hosting | **Railway** (Node + Nixpacks) | NOT Vercel, NOT CF Workers anymore |
| Database | **Railway Postgres** | private network → app services |
| ORM | **Drizzle** + `postgres-js` | runs on Node — no edge constraint |
| Storage | **Cloudflare R2** (S3 API) | egress ฟรี — original + resized variants |
| Image serve | `files.pipecommerce.com` → **r2-proxy worker** → R2 | apps/r2-proxy is the only CF Worker left |
| Custom domain | **Cloudflare for SaaS** (Custom Hostnames) → CNAME → Railway | SSL issued by Railway / Let's Encrypt |
| Auth (admin/staff) | **Auth.js v5 (NextAuth)** + Drizzle adapter + Resend magic link | database session strategy |
| Auth (storefront customer) | custom JWT + table `customers` | แยกจาก admin auth |
| Payment | **Beamcheckout** (Hosted Payment Links + Webhook) | per-shop merchant account |
| Queue | **pg-boss** (Postgres-backed) | replaces CF Queues — runs in admin worker |
| Cron | **Railway Cron** | replaces CF Cron Triggers |
| Cache | in-memory + Postgres | replaces CF KV (shop-by-domain table + cache headers) |
| Email | **Resend** + **React Email** | transactional + Auth.js magic link |
| Validation | **Zod** | |
| UI | **shadcn/ui** + **Tailwind 4** | |
| Forms | **React Hook Form** + Zod | |
| Error tracking | **Sentry** (Node SDK) | |
| Logging | Railway built-in log drain | |
| Tests | **Vitest** + **Playwright** + **pgTAP** (RLS tests) | |
| Migration | **drizzle-kit** | |
| Package manager | **pnpm** | workspaces |
| Build orchestration | **Turborepo** | |

### ที่ไม่ใช้ และเหตุผล

| ❌ ไม่ใช้ | เหตุผล |
|---|---|
| Vercel | Railway ราคา/scale ดีกว่าและไม่ผูก Next.js เวอร์ชัน |
| Cloudflare Workers (สำหรับ Next.js) | postgres-js + Hyperdrive ค้างเป็น minute-level — เลิกใช้ 2026-05 |
| Supabase Auth + DB | Auth.js + Railway PG cover MVP; ลด vendor dependency |
| Inngest / Trigger.dev | pg-boss + Railway Cron เพียงพอ ลด vendor |
| Stripe Connect | ใช้ Beamcheckout แทน (ตลาดไทย) |
| Redis (Upstash) | Postgres + in-memory เพียงพอตอนต้น |
| Microservices | monorepo monolith Next.js + workers เพียงพอ |
| Prisma | Drizzle เบากว่า + raw SQL friendly |
| tRPC | ใช้ REST/Server Actions — public API จะเปิดทีหลัง |
| Schema-per-tenant | shared schema + RLS เพียงพอ migration ง่ายกว่ามาก |

---

## Multi-tenancy Model

**Shared schema + `shop_id` + RLS**

ทุกตารางที่เกี่ยวกับร้านมี `shop_id` คอลัมน์, RLS policy เช็คผ่าน:

```sql
-- helper function
CREATE FUNCTION auth.shop_ids() RETURNS uuid[] AS $$
  SELECT ARRAY(SELECT shop_id FROM shop_members WHERE user_id = auth.uid())
$$ LANGUAGE sql STABLE;

-- pattern policy ที่ใช้ทุกตาราง
CREATE POLICY "members access own shop"
ON products FOR ALL
USING (shop_id = ANY(auth.shop_ids()));
```

ดูรายละเอียดเต็มที่ [SCHEMA.md](SCHEMA.md)

---

## Hosting & Domain Layout

```
yourapp.com              → marketing site (static)
admin.yourapp.com        → apps/admin
{shop-slug}.yourapp.com  → apps/storefront (default subdomain ทุกร้าน)
{custom-domain}          → apps/storefront (ผ่าน CF for SaaS)
liff.yourapp.com         → apps/storefront-liff (LINE LIFF, Phase 2)
cdn.yourapp.com          → R2 public bucket (รูปภาพ)
```

ดู flow custom domain ที่ [CUSTOM-DOMAIN.md](CUSTOM-DOMAIN.md)

---

## Storefront Rendering Strategy

| Page | Strategy | Cache |
|---|---|---|
| Home, collections, product list | **ISR** | revalidate-on-tag เมื่อแก้ใน admin |
| Product detail | **ISR** | revalidate-on-tag |
| Cart | **Dynamic SSR** หรือ Client | no-cache |
| Checkout | **Dynamic SSR** | no-cache |
| Admin | **CSR** + TanStack Query | no-cache |

Cache tag pattern: `shop:{id}:product:{id}`, `shop:{id}:collection:{handle}`

---

## Image Pipeline

**Approach (final):** Pre-generate **3 variants** ตอน upload เท่านั้น (low / mid / high) → serve direct จาก R2 ผ่าน `cdn.yourapp.com`

ไม่มี on-demand resize, ไม่มี Worker resolver — เรียบง่าย, ต้นทุนคาดเดาได้, ไม่ต้องคิดเรื่อง abuse

### Variant sizes

| Variant | Width | ใช้ที่ไหน |
|---|---|---|
| `low` | 400px | thumbnail, cart, search results, OG image |
| `mid` | 800px | product listing, collection, mobile product detail |
| `high` | 1600px | desktop product detail, zoom, full view |

ทุก variant: format = **WebP**, quality = **85**, fit = **scale-down** (ไม่ขยายถ้า original เล็กกว่า)

### Flow

```
[Browser] presigned PUT → R2: shops/{shop_id}/orig/{uuid}.{ext}
   ↓
[Backend] insert product_images { r2_key, variants_generated: false }
   ↓
[CF Queue: image-process]
   - R2.get(orig)
   - transform → low (400), mid (800), high (1600) ผ่าน Image Resizing
   - R2.put(low.webp), R2.put(mid.webp), R2.put(high.webp)
   - update product_images.variants_generated = true
   ↓
[Browser request] cdn.yourapp.com/shops/{id}/img/{uuid}/{low|mid|high}.webp
   → R2 ตรง (egress ฟรี)
```

### R2 key pattern

```
shops/{shop_id}/orig/{uuid}.{ext}              -- ต้นฉบับ (private bucket หรือ จำกัด access)
shops/{shop_id}/img/{uuid}/low.webp            -- public via cdn.yourapp.com
shops/{shop_id}/img/{uuid}/mid.webp
shops/{shop_id}/img/{uuid}/high.webp
```

### Picking variant ใน frontend

```tsx
// packages/ui/src/Image.tsx — convention helper
function shopImg(shopId: string, uuid: string, size: 'low' | 'mid' | 'high') {
  return `https://cdn.yourapp.com/shops/${shopId}/img/${uuid}/${size}.webp`
}

<img
  src={shopImg(shopId, uuid, 'mid')}
  srcSet={`${shopImg(shopId, uuid, 'low')} 400w,
           ${shopImg(shopId, uuid, 'mid')} 800w,
           ${shopImg(shopId, uuid, 'high')} 1600w`}
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

### Cleanup

- เมื่อร้านลบรูป → ลบทั้ง `orig/{uuid}` + `img/{uuid}/*`
- Cron weekly: ตรวจ `product_images` ที่ `deleted_at IS NOT NULL` และลบ R2 keys

### Cost

- Image Resizing: $0.50 / 1,000 transforms × 3 variants = **$1.50 / 1,000 รูป upload**
- R2 storage: ~50KB × 3 + 200KB orig ≈ 350KB/รูป → **$0.0053/1,000 รูป/เดือน**
- R2 egress: **ฟรี**

---

## Payment Architecture (Beamcheckout)

Beamcheckout ไม่มี marketplace API → ทุกร้านต้องมี Beam merchant account ของตัวเอง

```
Onboarding:
  เจ้าของร้าน → สมัคร Beam, ผ่าน KYC → ได้ API key
  → ใส่ API key ใน admin (เข้า Supabase Vault encrypt)

Checkout flow:
  [Customer คลิก "ชำระเงิน"]
    ↓
  [Worker] สร้าง order = "pending"
    ↓
  [Worker] เรียก Beam Payment Links API ด้วย API key ของร้าน
    POST /payment-links { amount, reference: order_id, ... }
    ↓
  redirect → Beam hosted page (Beam จัดการ 3DS)
    ↓
  [Beam webhook → Worker]
    → enqueue "beam-webhook-process" (CF Queue)
    ↓
  [Consumer]
    - verify webhook signature (Web Crypto API)
    - update order = "paid"
    - decrement inventory ใน transaction (FOR UPDATE)
    - enqueue "email-confirmation"
    - enqueue "fulfillment"
```

**Monetization model:** Subscription fee รายเดือน — ไม่ take application fee เพราะเงินเข้าบัญชีร้านโดยตรง

---

## Authentication

แยกเป็น 2 โดเมน auth ที่ต่างกันโดยสิ้นเชิง

### Admin / Staff Auth (เจ้าของร้าน + พนักงาน)
- **Auth.js v5 (NextAuth)** — Resend magic link เป็น primary, จะเพิ่ม Google OAuth ทีหลัง
- Drizzle adapter เก็บใน tables `users` / `accounts` / `sessions` / `verification_tokens`
- `session.strategy = 'database'` → opaque cookie token, ไม่ใช่ JWT
- `shop_members.user_id` FK → `users.id`
- RLS เก่าที่อ้าง `auth.uid()` (Supabase) ไม่ใช้แล้ว — authorize ใน application layer
  (Next.js Server Actions เช็ค membership ก่อนทุก mutation)

### Customer Auth (storefront)
- **Custom flow** — ไม่ใช้ Supabase Auth (เพราะ identity ของ customer scoped per-shop)
- รองรับ **multi-provider**:

| Provider | Phase | Implementation |
|---|---|---|
| Email magic link | **MVP** | สร้าง token → ส่งผ่าน Resend → callback verify |
| Google OAuth | **MVP** | platform-level OAuth app |
| Facebook OAuth | **MVP** | platform-level OAuth app |
| LINE Login | **P2** | per-shop channel (มาพร้อม LIFF) |

**Per-shop control:** ในตาราง `shop_auth_settings` (ดู SCHEMA.md) เจ้าของร้านเลือกได้ว่าจะเปิด provider ไหนบ้างใน storefront ของตัวเอง

### OAuth credentials strategy

- **Google + Facebook** = platform-level (1 OAuth app กลาง)
  - Consent screen แสดง brand "PipeCommerce" — ลูกค้าเห็นว่า login ผ่านแพลตฟอร์ม
  - Redirect URI: `https://auth.yourapp.com/oauth/{provider}/callback?shop={shop_id}`
  - หลัง callback → exchange code → get profile → upsert `customers` + `customer_identities` → mint custom JWT → set httpOnly cookie ของ shop domain
- **LINE** = per-shop (P2)
  - แต่ละร้านมี LINE channel ของตัวเอง (เพราะ userId ผูกกับ channel)
  - Credentials เก็บใน Supabase Vault เหมือน Beam

### Identity model

ลูกค้า 1 คน = 1 row ใน `customers` (per shop) + N rows ใน `customer_identities` (1 ต่อ provider ที่ link)

```
customers (shop_id, email)
  ↑
customer_identities (customer_id, provider, provider_user_id)
  ↳ google: sub
  ↳ facebook: app-scoped id
  ↳ line: line_user_id (also linked in customer_line_identities for LINE-specific data)
  ↳ email: NULL provider_user_id, verified by magic link
```

**Identity merge logic:** ถ้า customer login ด้วย provider ใหม่ที่ email ตรงกับ existing customer ของ shop เดียวกัน → **prompt user "merge accounts?"** ก่อน, ไม่ auto-merge เพื่อกัน account takeover

### Session

- Custom JWT signed ด้วย `JWT_SECRET` ของแพลตฟอร์ม
- Payload: `{ customer_id, shop_id, exp, jti }`
- เก็บใน httpOnly cookie scoped ที่ shop domain
- TTL 30 วัน, sliding (refresh on activity)
- Revocation list ใน KV (สำหรับ logout-all-devices)

---

## Theme System

Storefront ของแต่ละร้านปรับแต่งได้ผ่านระบบ theme + drag-drop visual editor

### Approach: "Online Store 2.0"-style

```
Theme = แพ็กเกจ React component ที่ platform ship
   ├── theme.json           ← schema declaration
   ├── pages/               ← HomePage, ProductPage, CollectionPage, CartPage
   ├── sections/            ← Hero, FeaturedProducts, RichText, ImageGrid, ...
   └── components/          ← UI primitives เฉพาะ theme

Per-shop config (JSON ใน DB)
   ├── settings             ← colors, fonts, header style, footer
   ├── templates            ← per-page: ลำดับ + settings ของแต่ละ section
   └── assets               ← logo, favicon, hero images (R2)
```

### MVP Scope

| Feature | MVP | Phase |
|---|---|---|
| 5 starter themes | ✅ | MVP |
| Global settings (colors, typography, header/footer) | ✅ | MVP |
| Section reorder + add/remove บน **home page** | ✅ | MVP |
| **Drag-drop visual builder** | ✅ | MVP |
| Logo/favicon/section images upload | ✅ | MVP |
| Live preview ผ่าน iframe + postMessage | ✅ | MVP |
| Section editing บน collection/product pages | — | P2 |
| Draft / publish workflow + version history | — | P2 |
| Custom CSS field (sanitized) | — | P2 |
| theme เพิ่มเติม (5 → 8–10 ตัว) | — | P2 |
| Custom theme upload (.zip) | — | P3 |
| Theme marketplace | — | P3 |

### 5 Themes ใน MVP (suggested)

| Code | สไตล์ | Use case |
|---|---|---|
| `minimal` | Clean, monochrome, ขาวเยอะ | Fashion, lifestyle, designer goods |
| `classic` | Traditional, จัด layout เป็น grid ชัด | ของชำ, อาหาร, ของใช้ทั่วไป |
| `bold` | สีสด, type ใหญ่, energetic | Streetwear, ของขวัญ, วัยรุ่น |
| `showcase` | Image-heavy, hero ใหญ่, gallery | Art, photography, premium goods |
| `boutique` | Elegant, serif, สีเอิร์ธโทน | Beauty, jewelry, luxury |

### Theme schema (`theme.json`)

แต่ละ theme declare:

```jsonc
{
  "code": "minimal",
  "version": "1.0.0",
  "settings_schema": [
    { "type": "color", "id": "primary", "label": "Primary", "default": "#000" },
    { "type": "font", "id": "heading_font", ... },
    { "type": "select", "id": "header_style", "options": ["minimal", "classic", "centered"] }
  ],
  "sections": [
    {
      "type": "Hero",
      "name": "Hero banner",
      "settings_schema": [
        { "type": "image", "id": "background", "label": "Background image" },
        { "type": "text", "id": "heading", "label": "Heading" },
        { "type": "url", "id": "cta_url" }
      ],
      "blocks": [],
      "max_blocks": 0
    },
    {
      "type": "FeaturedProducts",
      "settings_schema": [
        { "type": "collection", "id": "collection_id" },
        { "type": "range", "id": "limit", "min": 4, "max": 12 }
      ]
    }
    // ... RichText, ImageGrid, Newsletter, Testimonials, Logos, Slideshow
  ],
  "templates": {
    "home": { "default_sections": [...] },
    "product": { "locked": true, "sections": [...] },
    "collection": { "locked": true, "sections": [...] },
    "cart": { "locked": true }
  }
}
```

ใน MVP `locked: true` หมายถึงร้านแก้ไม่ได้ — ใช้ default ของ theme. เปิดให้แก้ใน P2

### Drag-drop Editor Architecture

```
┌─────────────────────────────────────────────────────────┐
│ apps/admin /[shopSlug]/theme/editor                      │
│                                                          │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ Sections    │  │  Live Preview    │  │ Settings   │ │
│  │ (sidebar)   │  │  (iframe)        │  │ panel      │ │
│  │             │  │                  │  │            │ │
│  │ + Hero      │  │  storefront in   │  │ form auto- │ │
│  │   Featured  │  │  draft mode      │  │ generated  │ │
│  │ ≡ RichText  │  │  with current    │  │ from       │ │
│  │   ImageGrid │  │  draft state     │  │ settings   │ │
│  │             │  │                  │  │ schema     │ │
│  │ [+ Add]     │  │                  │  │            │ │
│  └─────────────┘  └──────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────┘
       ↓ dnd-kit                ↑↓ postMessage
       reorder/add/remove       draft state sync
       updates draft state      + selected-section
```

**Tech:**
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-drop primitives
- iframe sandbox loading `liff.yourapp.com... wait` — โหลด `https://{shop-domain}/?theme_draft=<token>` (storefront รับ token → ใช้ draft settings ของ shop_theme_settings.draft_*)
- postMessage protocol:
  - `editor → iframe`: `{ type: 'state.update', settings, templates }`
  - `iframe → editor`: `{ type: 'section.click', sectionId }` (สำหรับเลือก section ใน preview)
- Auto-save draft ทุก 5 วิ → API → DB
- "Publish" button → atomic copy `draft_*` → published columns + revalidate cache tags

**Settings panel auto-generation:**

```tsx
// packages/admin/theme-editor/SettingsPanel.tsx
function renderField(field, value, onChange) {
  switch (field.type) {
    case 'color': return <ColorPicker ... />
    case 'font': return <FontPicker ... />
    case 'image': return <ImagePicker ... />  // upload to R2
    case 'select': return <Select options={field.options} ... />
    case 'range': return <Slider min={field.min} max={field.max} ... />
    case 'collection': return <CollectionPicker ... />
    case 'product': return <ProductPicker ... />
    case 'url': return <UrlInput ... />
    case 'text': return <TextInput ... />
    case 'richtext': return <Editor ... />  // tiptap
  }
}
```

### Storefront rendering

```tsx
// apps/storefront/app/_storefront/[shopId]/page.tsx (home)
const shop = await getShop(shopId)
const { theme_id, settings, templates, draft_settings, draft_templates } 
  = await getThemeSettings(shopId)

// ถ้ามี draft token + valid → ใช้ draft state
const isDraft = await verifyDraftToken(searchParams.theme_draft, shopId)
const activeSettings = isDraft ? draft_settings : settings
const activeTemplates = isDraft ? draft_templates : templates

const Theme = await loadTheme(theme_id)   // dynamic import เฉพาะ theme ที่ใช้

return (
  <Theme.HomePage settings={activeSettings}>
    {activeTemplates.home.sections.map(s => {
      const SectionComponent = Theme.sections[s.type]
      return <SectionComponent key={s.id} settings={s.settings} blocks={s.blocks} />
    })}
  </Theme.HomePage>
)
```

### Asset (image) handling

- Logo, favicon, section image → upload ไป R2 ผ่าน `image-process` queue (เหมือน product image)
- เก็บใน `shop_theme_assets` พร้อม key เช่น `logo`, `favicon`, `section-hero-1-bg`
- Section settings อ้างอิง asset ผ่าน asset id

### Cache invalidation เมื่อ publish

```
publish() {
  await db.transaction(async tx => {
    await tx.update(shop_theme_settings).set({
      settings: draft_settings,
      templates: draft_templates,
      published_at: now(),
    })
  })
  // revalidate tags: ทุกหน้า public ของ shop นี้
  await revalidateTag(`shop:${shopId}:storefront`)
  // หรือ specific: shop:{id}:home, shop:{id}:product:*
}
```

### Performance considerations

- **Bundle splitting:** dynamic import theme เฉพาะที่ shop ใช้ — ไม่ load 5 themes พร้อมกัน
- **Draft mode = no cache** — ใน editor preview ต้อง dynamic SSR ตลอด
- **Published mode = ISR** — revalidate เมื่อ publish เท่านั้น
- **Image variants** — section images ใช้ pipeline เดียวกับ product image (low/mid/high)

### Tradeoffs ที่ยอม

- **Bundle ใหญ่กว่า single-theme** — แก้ด้วย dynamic import + theme version pinning per shop
- **Migration ซับซ้อนเมื่อเปลี่ยน theme schema** — ใช้ semver, รองรับ migration script per major version
- **Drag-drop builder = engineering หนัก** (~3–4x ของ form-based) — ยอมรับเพราะเป็น critical feature สำหรับ shop owner

---

## CRM & Loyalty

ระบบ CRM + สะสมแต้ม แบ่งเป็น 3 phase ชัดเจน เพื่อไม่ให้ scope creep ใน MVP

### Scope per phase

| Feature | Phase | หมายเหตุ |
|---|---|---|
| Customer profile + tags + notes | **MVP** | ขยาย `customers` ที่มีอยู่ |
| Customer groups (VIP, ขายส่ง) | **MVP** | กระทบ pricing/discount eligibility |
| Loyalty program (1 program/ร้าน) | **MVP** | earn rate, redeem rate, expiry config |
| Earn points อัตโนมัติเมื่อ order paid | **MVP** | ผ่าน Beam webhook → Queue |
| Redeem points เป็นส่วนลดใน checkout | **MVP** | คำนวณใน cart, lock ตอนสร้าง order |
| Points ledger (append-only) | **MVP** | source of truth |
| Tier system (Bronze/Silver/Gold + multiplier) | P2 | |
| Birthday / signup bonus | P2 | hook อยู่ใน ledger แล้ว |
| Referral program | P2 | |
| Earn จาก review | P2 | |
| Customer events timeline | P2 | |
| Email campaigns + audiences | P2 | |
| Marketing automation (drip, win-back) | P3 | ใช้ CF Workflows |
| Dynamic segments (rule-based) | P3 | |

### Core architectural principles

1. **Ledger pattern** — `loyalty_ledger` เป็น append-only เด็ดขาด ห้าม UPDATE/DELETE (มี Postgres RULE บังคับ). `customer_loyalty.points_balance` เป็น cache คำนวณจาก ledger เพื่อ query เร็ว

2. **Redemption แยกจาก discounts** — ใช้ตาราง `loyalty_redemptions` ผูกกับ cart/order โดยตรง ไม่เข้า rule engine ของ discount เพราะ semantics ต่างกัน (balance deduction vs rule)

3. **Point precision = integer** — 1 คะแนน = หน่วยเล็กที่สุด ห้ามมี fractional point

4. **Earn timing** — ให้แต้ม **เมื่อ order = paid** (ไม่ใช่ตอนสร้าง order) เพื่อกัน fraud / order ที่ไม่จ่าย. ถ้า refund → reverse ผ่าน ledger entry ใหม่

5. **Redemption timing** — lock ตอน finalize cart → order; ถ้า cart abandon, redemption status = `reversed` ไม่กระทบ ledger

### Earn flow

```
[Beam webhook: order.paid]
  ↓ enqueue "loyalty-earn" { order_id }
[Queue consumer: loyalty-earn]
  - load order + customer
  - load active loyalty_program for shop
  - eligible_amount = order.subtotal_price - order.total_discounts (ถ้า excludes_discounts=true)
  - points = floor(eligible_amount / program.earn_rate_amount)
  - apply tier multiplier ถ้ามี (Phase 2)
  - INSERT loyalty_ledger {
      type: 'earn',
      points: +N,
      reason: 'order_paid',
      reference_type: 'order', reference_id: order.id,
      expires_at: now + program.points_expiry_months,
      balance_after: ...
    }
  - UPDATE customer_loyalty
      SET points_balance = points_balance + N,
          points_lifetime = points_lifetime + N,
          last_activity_at = now()
  - UPDATE order SET loyalty_points_earned = N
  - emit customer_event 'points_earned' (Phase 2)
```

### Redeem flow

```
[Customer ใน cart] เลือกใช้ N คะแนน
  ↓ POST /cart/{id}/loyalty/apply { points: N }
[Storefront API]
  - validate: customer มี balance >= N
  - validate: N >= program.redeem_min_points
  - validate: amount = N * redeem_value_per_point <= cart_total * redeem_max_pct
  - upsert loyalty_redemptions { cart_id, points_used: N, amount_applied, status: 'pending' }
  - return ราคาใหม่

[Cart → Order finalize]
  - ตอน checkout success:
    - INSERT loyalty_ledger { type: 'redeem', points: -N, reference_type: 'order', reference_id: order.id, balance_after: ... }
    - UPDATE customer_loyalty SET points_balance -= N
    - UPDATE loyalty_redemptions SET order_id, ledger_id, status = 'applied'
    - UPDATE order SET loyalty_points_redeemed = N, loyalty_amount_redeemed = ...
  - ทำใน DB transaction เดียว + SELECT FOR UPDATE customer_loyalty row กัน race
```

### Refund flow

```
[Order refunded]
  - หาก refund full:
    - INSERT ledger { type: 'refund_reverse', points: -loyalty_points_earned } (เอาแต้มที่ให้ไปคืน)
    - INSERT ledger { type: 'refund_reverse', points: +loyalty_points_redeemed } (คืนแต้มที่ใช้)
  - หาก refund partial: pro-rate ตามสัดส่วน
```

### Expiry flow

```
[Cron: ทุกวัน 03:00]
  - หา ledger.type='earn' WHERE expires_at < now()
    AND ยังไม่มี matching expire entry สำหรับ row นั้น (track ผ่าน reference_id)
  - คำนวณยอดที่ยัง active ของ customer (sum ของ earn ที่ยังไม่หมดอายุ - sum ของ redeem)
  - ถ้า balance > active_points → INSERT ledger { type: 'expire', points: -(diff) }
  - update customer_loyalty.points_balance ตามนั้น

[Cron: ทุกสัปดาห์]
  - หา customer ที่มีแต้มจะหมดใน 30 วัน → enqueue email "แต้มของคุณจะหมดอายุ..."
```

**MVP simplification:** ใช้ "balance-level expiry" — sum ของ earn ที่ expires_at < now ทั้งหมด แล้วหักออกครั้งเดียว ไม่ track FIFO consumption. ถ้า user redeem ไปก่อนแล้ว, expiry จะหักจาก balance ปัจจุบัน (clamp ที่ 0)

---

## LINE Integration `[Phase 2]`

> **Status:** Phase 2 — design ลงไว้เพื่อให้ MVP schema/architecture ไม่ block ทีหลัง

### Scope (Phase 2)

| Feature | หมายเหตุ |
|---|---|
| LINE Login เป็น customer auth provider | เสริมจาก Google/Facebook ใน MVP |
| LIFF Storefront (UI แยก) | `apps/storefront-liff` deploy ที่ `liff.yourapp.com` |
| Per-shop LINE channel config | admin UI ใส่ channel_id, secret, access token |
| Per-shop multiple LIFF apps | storefront, my-orders, points |
| Webhook handler (follow/unfollow) | enroll/exclude loyalty อัตโนมัติ |
| Push notification | event ที่ต้องการ: order paid, points earned (ดู subsection) |
| Rich Menu management | admin generate + deploy ไปยัง LINE |

### Out of scope (เลื่อนไป Phase 3)
- Broadcast / segment campaign UI
- Bot auto-reply / chatflow
- LINE Pay (ใช้ Beam อย่างเดียว)

### Architecture

```
┌─────────────────────────────────────────────────────┐
│ Per-shop LINE Official Account (เจ้าของร้านสมัครเอง) │
│  - channel_id, channel_secret, access_token         │
│  - LIFF apps (storefront, points, ...)              │
└─────────────────────────────────────────────────────┘
                       ↓
[Customer เปิด LIFF link หรือ chat OA]
                       ↓
┌─────────────────────────────────────────────────────┐
│ liff.yourapp.com (apps/storefront-liff)             │
│  - resolve shop จาก LIFF id หรือ path               │
│  - LIFF SDK init → get profile + accessToken        │
│  - exchange → customer_identities + JWT             │
│  - render LIFF-specific UI (tighter, mobile-first)  │
└─────────────────────────────────────────────────────┘

[Server-initiated push]
  Event (order.paid, loyalty.earned, ...) 
    → enqueue line-push
    → Worker: load shop's LINE access_token → call LINE Messaging API
```

### Apps split: ทำไม LIFF แยก app

- **UX ต่างกัน** — LIFF อยู่ใน WebView ของ LINE, ขนาดจอจำกัด, มี LIFF-specific gesture
- **Bundle ต่างกัน** — LIFF SDK + ไม่ต้อง SEO/ISR/marketing
- **Auth flow ต่างกัน** — LIFF auth ผ่าน LINE token ตรง ไม่ผ่าน OAuth redirect
- **Deploy แยก scale แยก** — push เยอะตอน campaign จะไม่กระทบ storefront

Shared ผ่าน packages: `core`, `db`, `ui` (subset), `auth`, `loyalty`

### LIFF authentication flow

```
[Customer เปิด LIFF URL]
  ↓
[apps/storefront-liff] LIFF SDK init({ liffId })
  ↓
liff.getIDToken() → ID token (JWT signed by LINE)
  ↓
POST /api/auth/line-liff
  Body: { id_token, shop_id }
  ↓
[Server]
  - verify id_token signature ผ่าน LINE JWKS
  - extract sub = line_user_id
  - upsert customer + customer_identities (provider=line, provider_user_id=sub)
  - upsert customer_line_identities (linked กับ shop's channel)
  - mint platform JWT, set cookie
  ↓
[Storefront ใช้งานปกติ — cart, checkout, points]
```

### Push notification (design ไว้, implement ทีหลัง)

**Events ที่ต้องการ (confirmed):**
- `order.paid` → ส่งใบเสร็จ + tracking link
- `loyalty.points_earned` → "🎉 ได้ +N คะแนน, รวม X คะแนน"

**Events ที่อาจเพิ่มภายหลัง:**
- `order.shipped` → tracking number
- `order.delivered` → ขอรีวิว
- `loyalty.points_expiring_soon` → เตือนก่อนแต้มหมด
- `cart.abandoned` → ดึงกลับมา

**Implementation pattern:**
```
[Domain event เกิดขึ้น เช่น beam-webhook → order.paid]
  → emit "order.paid" → enqueue ทุก notification channel ที่ enable
    - email-send (ถ้า customer มี email)
    - line-push (ถ้า customer link LINE + opt-in)
    
[CF Queue: line-push consumer]
  - load shop_line_channels.access_token (decrypt vault)
  - load customer_line_identities.line_user_id
  - render template (Flex Message สำหรับใบเสร็จ, text สำหรับ points)
  - call POST https://api.line.me/v2/bot/message/push
  - log ลง line_messages
  - retry on 429/5xx ผ่าน Queue retry
```

**Quiet hours / opt-in:**
- ทุก customer ต้อง opt-in ในตอน LINE Login ครั้งแรก (`customer_line_identities.notifications_enabled`)
- Quiet hours: 22:00–08:00 timezone ของร้าน — delay จนถึง 08:00
- Per-event opt-out (transactional vs marketing)

### Cost / Compliance ที่ shop owner ต้องรับ

- LINE OA plan (Free/Light/Standard) — เจ้าของร้านจ่ายเอง
- เกิน push quota → cost ต่อ message — แจ้ง limit ใน admin UI
- Quiet hours, opt-in, frequency cap = บังคับใน platform เพื่อ compliance LINE ToS + PDPA

### Integration กับ existing flows

- **Order creation:** `core/order/create.ts` ต้องเรียก `loyalty/applyRedemption` ใน transaction เดียว
- **Beam webhook handler:** ต้อง enqueue `loyalty-earn` หลัง update order.financial_status = 'paid'
- **Refund handler:** ต้อง emit `loyalty-reverse`
- **Customer signup:** `auth/onSignup` enqueue `loyalty-signup-bonus` (P2 ถ้า bonus > 0)

### Concurrency / race conditions

- Redeem พร้อมกัน 2 หน้าจอ → `SELECT customer_loyalty FOR UPDATE` ใน transaction
- Earn จาก order paid + admin manual adjust ชน → ledger insert เป็น atomic unit, recalculate balance จาก ledger ถ้าสงสัย
- Trust ledger เสมอ — ถ้า cache (`points_balance`) drift, มี job recalculate ทุกคืน

---

## Search & Faceted Filter

### Engine choice (MVP): Postgres FTS + pg_trgm

ตลาดไทยมีปัญหา Thai tokenization — ภาษาไทยไม่มีช่องว่างระหว่างคำ Postgres default tokenizer ไม่ตัดคำไทยถูก

**Pragmatic approach (MVP):**
- ใช้ `pg_trgm` (trigram similarity) สำหรับ fuzzy match — ทำงานกับภาษาใดก็ได้
- เสริมด้วย `tsvector` กับ `unaccent` สำหรับ exact term match
- Filter (faceted) ใช้ Postgres normal queries

**ถ้าโตกว่านี้ค่อยย้ายไป:**
- **Meilisearch** (self-host บน VPS หรือ Meilisearch Cloud) — มี Thai tokenizer ดี
- **Typesense** Cloud
- **Algolia** — แพง แต่ดีสุด

ออกแบบ search API ให้ swap engine ได้: `packages/core/search/{provider}.ts`

### Schema

```sql
-- เพิ่มใน products:
search_vector  tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(unaccent(title), '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(array_to_string(tags, ' '), '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(unaccent(strip_html(description)), '')), 'C')
) STORED;

CREATE INDEX products_search_idx ON products USING GIN(search_vector);
CREATE INDEX products_trgm_idx ON products USING GIN(title gin_trgm_ops);
CREATE INDEX products_handle_trgm_idx ON products USING GIN(handle gin_trgm_ops);
```

### Faceted filter

หน้า collection: filter ตาม
- **Price range** — slider, query: `price BETWEEN $min AND $max`
- **Collections** (sub-collection)
- **Tags** — multi-select จาก `tags text[]` (GIN index)
- **Variant options** — size/color/material (pre-aggregate ใน collection page)
- **Availability** — in stock only

**Pre-aggregate facets ตอน build collection page:**
```sql
-- สำหรับ collection X, นับ count ของแต่ละ option
SELECT pv.option1 as value, count(distinct p.id) as count
FROM products p
JOIN product_variants pv ON pv.product_id = p.id
JOIN inventory_items ii ON ii.variant_id = pv.id
JOIN collection_products cp ON cp.product_id = p.id
WHERE cp.collection_id = $1 AND p.status = 'active' AND ii.available > 0
GROUP BY pv.option1;
```

Cache ผลลัพธ์ใน KV 5 นาที — invalidate เมื่อ product เปลี่ยน

### Search API

```
GET /api/search?q={query}&shop={id}&collection={handle}&price_min=&price_max=&tags=a,b&page=1
→ {
  results: [...],
  facets: { price_ranges, tags, options },
  total, page, total_pages
}
```

Storefront hits this through Server Component fetch — cache ผลลัพธ์ที่ edge (1 min)

---

## Tax Calculation

ขายในไทยต้องคิด VAT 7% ได้ + รองรับ multi-region สำหรับขายต่างประเทศในอนาคต

### Pricing modes (3 ตัวเลือก per shop)

| Mode | ราคาแสดง | Customer จ่าย | Net revenue ของร้าน | VAT ที่ต้องส่งรัฐ |
|---|---|---|---|---|
| **`inclusive_customer`** (default ไทย) | 107 | 107 | 100 | 7 (ลูกค้าเป็นคนจ่าย) |
| **`exclusive_customer`** | 100 (+VAT 7 ตอน checkout) | 107 | 100 | 7 (ลูกค้าเป็นคนจ่าย) |
| **`shop_absorbs`** | 100 | 100 | 93 | 7 (ร้านจ่ายจาก revenue) |

**Use cases:**
- `inclusive_customer` — ร้านทั่วไปที่จด VAT, แสดงราคารวมเสร็จ
- `exclusive_customer` — B2B หรือขายต่างประเทศ, ลูกค้าเห็นราคาก่อนภาษี
- `shop_absorbs` — ร้านจัดโปร "ราคานี้รวมทุกอย่าง" / ร้านอยากเสนอราคาเรียบ ลด margin เอง

### Math

```
rate = 0.07

inclusive_customer:
  customer_pays  = price                        (107)
  net_revenue    = price / (1 + rate)           (100)
  tax_collected  = price - net_revenue          (7)

exclusive_customer:
  net_revenue    = price                        (100)
  tax_collected  = price * rate                 (7)
  customer_pays  = net_revenue + tax_collected  (107)

shop_absorbs:
  customer_pays  = price                        (100)
  tax_owed       = price * rate / (1 + rate)    (~6.54)  ← VAT คิดจากราคารวม backwards
  net_revenue    = price - tax_owed             (~93.46)
```

> Note สำหรับ `shop_absorbs`: VAT คำนวณจากการ "back out" จากราคาขาย — กฎหมายไทยถือว่าราคาที่ได้รวม VAT แล้วเสมอ (ถ้าร้านจด VAT)

### Schema

```sql
-- เพิ่มใน shops.settings.tax:
{
  "enabled": true,                       -- ร้านจด VAT ไหม (false = ไม่ออกภาษีเลย)
  "tax_id": "0107...",                   -- เลขผู้เสียภาษี
  "default_rate": 0.07,
  "mode": "inclusive_customer",          -- inclusive_customer | exclusive_customer | shop_absorbs
  "shipping_taxable": true,
  "rounding": "line"                     -- line | total
}

-- ตารางใหม่:
tax_rates (
  id, shop_id, name, rate,
  country, province,
  applies_to     text,                   -- all | shipping | product
  is_compound, is_default, priority,
  ...
)
```

ดูรายละเอียดเต็มที่ [SCHEMA.md Section 7](SCHEMA.md)

### Calculation flow

```
[Cart calculation]
  for each line:
    rate = lookup_rate(shipping_address.country, .province) || default_rate
    
    switch tax.mode:
      case inclusive_customer:
        gross = price * qty
        tax = gross * rate / (1 + rate)
        net = gross - tax
      case exclusive_customer:
        net = price * qty
        tax = net * rate
        gross = net + tax
      case shop_absorbs:
        gross = price * qty                  ← customer จ่ายเท่านี้
        tax = gross * rate / (1 + rate)      ← ร้านส่งรัฐ (record ใน tax_lines แต่ไม่บวกใน customer_total)
        net = gross - tax                    ← revenue จริงของร้าน
  
  total_tax (collected from customer):
    inclusive | exclusive: sum ของ tax ทุก line + shipping_tax (ถ้า taxable)
    shop_absorbs: 0 (customer ไม่ได้จ่าย)
  
  total_tax_owed (ส่งรัฐ — สำหรับ report ภงด.):
    inclusive | exclusive | absorbed: sum ของ tax ทุก line + shipping_tax (ถ้า taxable)
```

### Receipt display

- `inclusive_customer` — แสดง subtotal, tax included, total (highlight ว่ารวมแล้ว)
- `exclusive_customer` — แสดง subtotal, tax (เพิ่ม), total
- `shop_absorbs` — แสดงเฉพาะ subtotal + total (ไม่โชว์ tax ให้ customer สับสน, แต่ใน admin/report ยังเห็นครบ)

### Snapshot

`order_line_items.tax_lines` (jsonb) เก็บ:
```jsonc
{
  "rate": 0.07,
  "name": "VAT",
  "amount": 6.54,                // ที่ collect/owed
  "mode": "inclusive_customer",
  "absorbed_by_shop": false      // true เมื่อ mode = shop_absorbs
}
```
ห้ามคำนวณใหม่ — ออเดอร์เก่าใช้ snapshot เสมอ

### Tax-exempt customers (P2)

`customer_groups.perks.tax_exempt = true` → bypass tax (สำหรับ B2B)

### Out of scope (P2+)

- Multi-jurisdiction tax (US states, EU VAT MOSS)
- Tax registration thresholds
- Avalara/TaxJar integration

---

## Reports & Analytics

ทั้ง dashboard, downloadable, และ scheduled email report

### Architecture (3 layers)

```
[Layer 1] Live SQL aggregation
  - sub-3-sec query สำหรับ ad-hoc range
  - admin dashboard fetch on-demand
  - cache 1 min ใน edge KV

[Layer 2] Pre-aggregated daily snapshot
  - cron 02:00 ทุกวัน (timezone ของแต่ละ shop)
  - aggregate วันก่อนหน้า → report_snapshots_daily
  - dashboard ใหญ่/หน้าแรก โหลดจาก snapshot ตรงๆ → instant

[Layer 3] Scheduled email
  - cron 08:00 ทุกวัน → daily digest (ถ้า user subscribe)
  - cron จันทร์ 08:00 → weekly
  - cron วันที่ 1 ของเดือน 08:00 → monthly
  - render React Email → ส่งผ่าน Resend
```

### Reports MVP

| Report | Dashboard | CSV download | Email digest | Source |
|---|---|---|---|---|
| Sales overview (revenue, orders, AOV, refunds) | ✅ | ✅ | daily/weekly/monthly | snapshot |
| Sales by product/variant | ✅ | ✅ | weekly | live SQL |
| Sales by collection | ✅ | ✅ | — | live SQL |
| Top customers (by spend) | ✅ | ✅ | monthly | live SQL |
| Discount usage | ✅ | ✅ | — | live SQL |
| **Tax collected** (period summary) | ✅ | ✅ | **monthly** (สำหรับ ภงด.50 / ภพ.30) | live SQL + snapshot |
| Inventory snapshot (current + low stock) | ✅ | ✅ | weekly low-stock alert | live SQL |
| Refunds | ✅ | ✅ | — | live SQL |
| Loyalty earned/redeemed | ✅ | ✅ | monthly | live SQL |

### Reports P2

- Cohort analysis (LTV by signup month)
- Traffic source / conversion funnel (depends on pixel integration)
- Abandoned cart performance
- Product velocity / sell-through rate
- Order tags analytics

### Schema

```sql
report_snapshots_daily (
  shop_id          uuid → shops,
  date             date,                   -- shop's local date
  
  -- sales
  orders_count     int DEFAULT 0,
  orders_paid      int DEFAULT 0,
  orders_cancelled int DEFAULT 0,
  gross_revenue    numeric(14,2) DEFAULT 0,    -- รวม VAT (customer_pays)
  net_revenue      numeric(14,2) DEFAULT 0,    -- หัก VAT แล้ว (revenue ของร้าน)
  total_tax_collected numeric(14,2) DEFAULT 0, -- จาก customer (inclusive/exclusive)
  total_tax_owed   numeric(14,2) DEFAULT 0,    -- ที่ต้องส่งรัฐ (รวม shop_absorbs)
  total_discounts  numeric(14,2) DEFAULT 0,
  total_shipping   numeric(14,2) DEFAULT 0,
  
  -- refunds
  refunds_count    int DEFAULT 0,
  refunds_amount   numeric(14,2) DEFAULT 0,
  
  -- customers
  customers_new    int DEFAULT 0,
  customers_returning int DEFAULT 0,
  
  -- units
  units_sold       int DEFAULT 0,
  
  -- loyalty
  points_earned    int DEFAULT 0,
  points_redeemed  int DEFAULT 0,
  
  -- top items (ใส่เลย ไม่ต้อง join — เร็วเวลาแสดง dashboard)
  top_products     jsonb,                 -- [{product_id, title, qty, revenue}] cap 10
  top_collections  jsonb,
  
  computed_at      timestamptz NOT NULL,
  PRIMARY KEY (shop_id, date)
)
CREATE INDEX ON report_snapshots_daily(shop_id, date DESC);
```

### Email subscription

```sql
report_email_subscriptions (
  id              uuid PK,
  shop_id         uuid → shops,
  user_id         uuid → auth.users,      -- shop_member ที่สมัคร
  type            text NOT NULL,           -- daily | weekly | monthly
  recipient_email text NOT NULL,           -- override ได้ (default = user.email)
  reports         text[] NOT NULL,         -- ['sales_overview', 'tax_collected', 'low_stock']
  is_active       boolean DEFAULT true,
  last_sent_at    timestamptz,
  created_at, updated_at
)
CREATE INDEX ON report_email_subscriptions(type, is_active) WHERE is_active = true;
```

### Implementation pattern

```ts
// packages/core/reports/sales-overview.ts
export async function salesOverview(shopId: string, range: { from: Date; to: Date }) {
  // ถ้า range = "yesterday/week/month" → ใช้ snapshot
  // ถ้า range = ad-hoc → live SQL
  
  if (matchesSnapshotRange(range)) {
    return db.query.reportSnapshotsDaily.findMany({
      where: and(eq(shopId), between(date, range.from, range.to))
    })
  }
  
  return db.execute(sql`
    SELECT 
      DATE_TRUNC('day', created_at) as day,
      COUNT(*) FILTER (WHERE financial_status = 'paid') as orders,
      SUM(total_price) FILTER (WHERE financial_status = 'paid') as revenue,
      ...
    FROM orders
    WHERE shop_id = ${shopId} AND created_at BETWEEN ${range.from} AND ${range.to}
    GROUP BY 1 ORDER BY 1
  `)
}
```

### CSV download

ใช้ pipeline เดียวกับ `bulk-export` queue → stream rows ไป R2 → presigned URL → email/UI

### Email rendering

`packages/email/templates/reports/{daily,weekly,monthly}.tsx` — React Email components

```tsx
// Example structure
<Email>
  <Header shop={shop} />
  <Section title="ยอดขายเมื่อวาน">
    <Stat label="Orders" value={data.orders_count} delta={...} />
    <Stat label="Revenue" value={fmt(data.gross_revenue)} />
    <Stat label="AOV" value={fmt(data.gross_revenue / data.orders_count)} />
  </Section>
  <Section title="Top Products">
    <ProductList items={data.top_products} />
  </Section>
  <Footer />
</Email>
```

### Cron triggers

```toml
# wrangler.toml ของ apps/workers/cron
[[triggers.crons]]
schedule = "0 19 * * *"  # 02:00 ICT = 19:00 UTC
handler = "computeDailySnapshots"

[[triggers.crons]]
schedule = "0 1 * * *"   # 08:00 ICT — daily email
handler = "sendDailyReports"

[[triggers.crons]]
schedule = "0 1 * * 1"   # Monday 08:00 ICT — weekly
handler = "sendWeeklyReports"

[[triggers.crons]]
schedule = "0 1 1 * *"   # 1st of month 08:00 ICT — monthly
handler = "sendMonthlyReports"
```

### Performance considerations

- ทุก aggregate query ต้องมี index ที่เหมาะสม (`orders(shop_id, created_at)`, `order_line_items(shop_id, order_id)`)
- Snapshot recompute — ถ้า admin แก้ order ย้อนหลัง (เช่น refund), enqueue `recompute-snapshot` สำหรับ shop+date นั้น
- Multi-shop snapshot — process แยก shop เพื่อไม่ให้ shop ใหญ่ block shop อื่น

---

## Customer Self-Service Portal

ลูกค้า login เข้า `/account` ได้

### Routes

```
/account                  → dashboard (orders summary, points balance, info)
/account/orders           → order history list
/account/orders/[id]      → order detail
/account/addresses        → address book CRUD
/account/profile          → edit profile, change preferences
/account/loyalty          → points balance + ledger history (loyalty)
/account/wishlist         → P2 — wishlist items
```

### Auth

- ใช้ customer JWT (จาก ADR-011 multi-provider auth)
- Middleware ของ storefront เช็ค JWT cookie → ใส่ context ให้ Server Component
- ถ้าไม่ login → redirect ไป `/account/login?return_to=...`

### Data access pattern

ทุก query ที่ /account ต้อง filter ด้วย `customer_id = ctx.customer.id` — RLS policy ของ `orders`, `customer_addresses`, `loyalty_ledger` ทำให้

```sql
CREATE POLICY "customer_own_orders"
ON orders FOR SELECT
TO anon  -- customer JWT ไม่ใช่ Supabase auth, ใช้ anon role + custom claim
USING (
  customer_id = (current_setting('app.customer_id', true))::uuid
);
```

หรือ bypass RLS ใน server code (แล้ว filter ด้วย `where(eq(orders.customerId, ctx.customer.id))` เอง — แนะนำแบบนี้เพราะตรงไปตรงมา)

### Order detail page

Public-shareable (อนาคต) — ดู section "Order Tracking Page" ถัดไป

---

## Order Tracking Page (Public)

ลูกค้า/guest ดูสถานะ order ได้โดยไม่ต้อง login — ลด ticket support มหาศาล

### URL

```
{shop-domain}/orders/{order_number}?token={tracking_token}
```

### Schema

```sql
-- เพิ่มใน orders:
tracking_token   text NOT NULL UNIQUE,    -- random opaque (32 chars), gen ตอนสร้าง order
```

ส่ง URL พร้อม `tracking_token` ใน:
- Order confirmation email
- Shipping notification email
- LINE push (P2)

### Page content

- Order summary (number, date, total — ไม่แสดง email/address ของลูกค้าให้คนอื่น)
- Status timeline: Placed → Paid → Preparing → Shipped → Delivered
- Shipping carrier + tracking number + link ไปหน้า carrier
- "Need help?" → contact form (route ไปหา shop owner)

### Security

- token = 32 chars (256-bit entropy) ดีพอ — เกือบเดาไม่ได้
- ไม่แสดง PII (email/address ของลูกค้า) แม้มี token ที่ถูกต้อง
- Rate limit per IP เพื่อกัน enumeration
- Optional: ใส่ "verify by entering email/phone" ก่อนแสดงรายละเอียด (P2)

---

## Bulk CSV Import / Export

shop owner ย้ายมาจาก platform อื่น หรือ batch update ราคา/stock — ต้องมี

### Resources ที่รองรับ (MVP)

| Resource | Import | Export |
|---|---|---|
| Products + variants | ✅ | ✅ |
| Customers | ✅ | ✅ |
| Orders | — | ✅ |
| Inventory | ✅ (update only) | ✅ |
| Discounts | ✅ | ✅ |

### Architecture

```
[Admin upload CSV → R2: shops/{id}/imports/{job_id}.csv]
  ↓
[Insert bulk_jobs row, status=queued]
  ↓
[Enqueue "bulk-import" CF Queue]
  ↓
[Consumer]
  - download CSV from R2
  - validate header + sample rows
  - chunk เป็น 100 rows/chunk
  - process each chunk in transaction
    - on conflict by handle/SKU/email → update
    - on validation error → log to bulk_jobs.errors
  - update progress every chunk (rows_processed/total_rows)
  - mark complete or failed
  ↓
[Admin polls /api/bulk-jobs/{id} หรือ Realtime subscription]
```

### Schema

```sql
bulk_jobs (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  type            text NOT NULL,           -- import | export
  resource        text NOT NULL,           -- products | customers | orders | inventory | discounts
  status          text NOT NULL,           -- queued | processing | completed | failed | cancelled
  
  -- input
  source_r2_key   text,                    -- CSV ที่ upload
  options         jsonb DEFAULT '{}',      -- { update_existing, skip_invalid, ... }
  
  -- progress
  total_rows      int,
  rows_processed  int DEFAULT 0,
  rows_succeeded  int DEFAULT 0,
  rows_failed     int DEFAULT 0,
  errors          jsonb DEFAULT '[]',      -- [{ row, message }] cap ที่ 100 entries
  
  -- output (export)
  result_r2_key   text,                    -- generated CSV
  result_url      text,                    -- presigned download URL (24h)
  
  created_at, started_at, completed_at, 
  created_by      uuid → auth.users
)
CREATE INDEX ON bulk_jobs(shop_id, created_at DESC);
```

### CSV format

ใช้ format ที่ Shopify-compatible เพื่อ import จาก Shopify ได้ตรงๆ
- `Handle, Title, Body (HTML), Vendor, Product Type, Tags, Published, Option1 Name, Option1 Value, ..., Variant SKU, Variant Price, Variant Inventory Qty, Image Src, Image Position, Image Alt Text, SEO Title, SEO Description`

Documentation ใน admin UI พร้อม template download

### Image import

CSV มี `Image Src` URLs → consumer download → upload ไป R2 → enqueue image-process

### Export

`/api/bulk-jobs?type=export&resource=products` → เริ่ม job → ผลลัพธ์เป็น CSV ใน R2 → presigned URL ส่งใน UI / email

### Limits ที่ต้องระวัง

- CF Worker มี CPU limit per request — chunk size ห้ามใหญ่
- R2 multipart upload สำหรับ CSV > 100MB
- Long-running export = stream rows เขียน R2 ทีละ chunk (ใช้ R2 multipart)

---

## Announcement Bar

Theme component ที่แสดง bar ด้านบนของ storefront (รองรับ rotating message + countdown)

### Schema

```sql
shop_announcement_bars (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  is_active       boolean DEFAULT true,
  
  -- content (รองรับ rotating หลายข้อความ)
  messages        jsonb NOT NULL,          -- [{ text, link, link_text, icon }]
  rotate_seconds  int DEFAULT 0,           -- 0 = ไม่หมุน, > 0 = หมุนทุก N วิ
  
  -- styling
  background_color text,
  text_color      text,
  
  -- behavior
  is_dismissible  boolean DEFAULT true,    -- ลูกค้ากดปิดได้
  
  -- targeting
  starts_at, ends_at timestamptz,          -- schedule
  show_on         text DEFAULT 'all',      -- all | home_only | exclude_checkout
  
  -- countdown (optional)
  countdown_to    timestamptz,             -- "เหลืออีก 2 ชม. 15 นาที..."
  
  created_at, updated_at
)
```

### Rendering

ทุก theme ต้อง implement `<AnnouncementBar />` component ใน layout ของ storefront. ดึง active bar จาก KV cache (5 min TTL).

Dismiss = client-side cookie (ไม่ track per-user เพื่อความ simple)

---

## Newsletter Signup

เก็บ email สำหรับ marketing campaign + integrate กับ `customers` table

### Schema

```sql
newsletter_subscribers (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  email           text NOT NULL,
  customer_id     uuid → customers NULL,   -- link ถ้า email match กับ existing customer
  source          text NOT NULL,           -- footer | popup | checkout | manual_import
  status          text NOT NULL,           -- subscribed | unsubscribed | bounced
  
  -- consent (PDPA)
  ip              inet,
  user_agent      text,
  consent_text    text,                    -- text ที่ user เห็นตอน subscribe
  subscribed_at   timestamptz NOT NULL,
  unsubscribed_at timestamptz,
  
  -- segmentation hints
  tags            text[] DEFAULT '{}',
  
  created_at, updated_at,
  UNIQUE (shop_id, email)
)
CREATE INDEX ON newsletter_subscribers(shop_id, status);
```

### Theme integration

- **Footer signup form** — theme component, render เมื่อ `settings.footer.show_newsletter = true`
- **Popup form** — P2 (welcome offer, exit intent)

### Flow

```
[Customer fill email + click subscribe]
  ↓
POST /api/newsletter/subscribe { email, source, consent_text }
  ↓
- upsert newsletter_subscribers
- if customer มี → link customer_id, set customers.accepts_marketing = true
- enqueue email "newsletter-welcome" (Resend) — optional welcome offer (gift card 10% etc.)
  ↓
return success
```

### Unsubscribe

ทุก newsletter email มี unsubscribe link → `/newsletter/unsubscribe?token={hmac}` → 1-click unsubscribe (PDPA + CAN-SPAM compliance)

### Out of MVP

- Campaign builder UI — P2 (เป็นส่วนของ marketing automation P3)
- ใน MVP เจ้าของร้าน export email list เป็น CSV → ใช้ Mailchimp/Klaviyo เองไปก่อน

---

## External Integrations `[Phase 3+]`

> **Status:** เลื่อนไป Phase 3+ — ไม่ทำใน MVP/P2 แต่วาง groundwork ไว้แล้ว

### Groundwork ที่มีใน MVP (ใช้ได้ทันทีเมื่อถึงเวลา)

| Building block | สถานะ |
|---|---|
| Outbound webhooks (`webhooks` + `webhook_deliveries`) | ✅ MVP |
| Domain event pattern (`order.paid`, `loyalty.points_earned`, etc.) | ✅ MVP |
| Audit logs (`audit_logs`) | ✅ MVP |
| Per-shop Vault สำหรับเก็บ credential (Beam, LINE) | ✅ MVP |

### Categories ที่จะทำใน Phase 3+

| Integration | Phase | Use case |
|---|---|---|
| Public REST API + Personal Access Tokens (PAT) | P3 | external dev สร้าง app/script บนแพลตฟอร์ม |
| Public OAuth2 (third-party apps) | P3 | "App Store"-style integrations |
| Inbound webhooks (signed) | P3 | external system push data เข้าระบบ |
| **Shippop / Shipnity** | P3 | shipping label + tracking (รวม 10+ ขนส่งไทย) |
| **FlowAccount / PEAK / Xero** | P3 | accounting/invoice sync (FlowAccount เด่นในไทย) |
| Lazada / Shopee multi-channel | P3 | inventory + order sync |
| GA4 / Meta Pixel / TikTok Pixel | **P2** | analytics & ads tracking (low effort, high value) |
| Mailchimp / Klaviyo | P3 | email marketing (เสริมจาก Resend) |
| Zapier / n8n connector | P3 | low-code automation |
| ERP (Odoo, SAP) | P3+ | enterprise customer |

### Design principles ที่จะ apply เมื่อทำ

- **API versioning:** ใช้ URL prefix `/api/v1/` ตั้งแต่ MVP — กัน breaking change ทีหลัง
- **Rate limiting:** Cloudflare WAF (edge) + per-shop quota ใน Postgres (token-bucket table)
- **Idempotency:** ทุก mutation API รองรับ `Idempotency-Key` header (Beam pattern)
- **Webhook signature:** HMAC-SHA256 ใช้ secret ของ webhook → ลูกค้า verify
- **Integration credentials:** เก็บใน table `shop_secrets` (pgcrypto encrypt-at-rest) per-shop
- **Connector pattern:** แต่ละ integration เป็น `packages/integrations/{name}` — ไม่ปนเปื้อนกับ core

### หมายเหตุ

- Public API ที่ลูกค้าใช้ ≠ internal API ระหว่าง storefront/admin ของเรา — แยก auth, แยก versioning
- ไม่ทำ "App Store" pattern (Shopify-style) ใน Phase 3 — เริ่มที่ first-party integrations ก่อน

---

## Background Jobs

ใช้ **pg-boss** (Postgres-backed queue) เริ่มต้น — ทำงานใน admin service เอง, ไม่ต้องแยก worker process:

| Queue | Producer | Consumer | Purpose |
|---|---|---|---|
| `beam-webhook` | webhook endpoint | queue-consumer | process payment events |
| `webhook-delivery` | order events | queue-consumer | ส่ง webhook ให้ระบบ external ของร้าน |
| `email` | order events, abandoned cart | queue-consumer | ส่ง email ผ่าน Resend |
| `image-process` | upload endpoint | queue-consumer | resize + upload variants |
| `inventory-sync` | stock changes | queue-consumer | webhook ภายนอก, etc |
| `loyalty-earn` | order paid event | queue-consumer | คำนวณ + ให้แต้มลง ledger |
| `loyalty-reverse` | refund event | queue-consumer | reverse แต้ม earn/redeem |
| `bulk-import` | admin upload CSV | queue-consumer | parse + chunk + upsert |
| `bulk-export` | admin request export | queue-consumer | stream rows → CSV ใน R2 |
| `abandoned-cart` | cron + cart event | queue-consumer | recovery email sequence |
| `line-push` `[P2]` | domain event fanout | queue-consumer | ส่ง LINE push ผ่าน Messaging API |
| `line-webhook` `[P2]` | LINE webhook endpoint | queue-consumer | follow/unfollow/message events |

**Cron Triggers** (Railway Cron → curl `/api/cron/<name>` พร้อม HMAC):
- abandoned cart recovery (ทุก 1 ชม.)
- subscription billing (ทุกวัน)
- cleanup expired carts (ทุกวัน)
- **report snapshot compute** (ทุกวัน 02:00 ICT) — aggregate วันก่อนหน้า → `report_snapshots_daily`
- **report email — daily** (ทุกวัน 08:00 ICT) — send digest ถ้า user subscribe
- **report email — weekly** (จันทร์ 08:00 ICT)
- **report email — monthly** (วันที่ 1 ของเดือน 08:00 ICT)
- **loyalty point expiry** (ทุกวัน 03:00) — หักแต้มหมดอายุ
- **loyalty expiry warning email** (ทุกสัปดาห์) — เตือนก่อนแต้มหมด 30 วัน
- **customer_loyalty cache reconciliation** (ทุกคืน) — recalculate จาก ledger กัน drift

**Durable workflows:** ยังไม่ใช้ external service — pg-boss state machine + cron polling เพียงพอสำหรับ wait-then-do แบบเป็นวัน

---

## Repository Structure

```
pipecommerce/
├── apps/
│   ├── storefront/          # Next.js 16 — public, custom domain (Railway)
│   ├── admin/               # Next.js 16 — console.pipecommerce.com (Railway)
│   ├── storefront-liff/     # Next.js 16 — liff.pipecommerce.com [P2]
│   └── r2-proxy/            # CF Worker — files.pipecommerce.com → R2
├── packages/
│   ├── db/                  # Drizzle schema + migrations + client
│   ├── core/                # business logic
│   │   ├── cart/            # cart calculation
│   │   ├── discount/        # rule engine
│   │   ├── order/           # order state machine
│   │   ├── inventory/       # stock operations
│   │   ├── pricing/         # price + tax engine
│   │   ├── tax/             # tax rate lookup + calculation
│   │   ├── search/          # FTS + facet aggregation (engine-swap-able)
│   │   ├── bulk/            # CSV import/export pipelines
│   │   ├── reports/         # aggregations + snapshot compute + email rendering
│   │   ├── crm/             # customer groups, notes, segments
│   │   ├── loyalty/         # ledger, earn/redeem/expire
│   │   └── notifications/   # event → channel fanout (email, line)
│   ├── beam/                # Beamcheckout SDK wrapper
│   ├── line/                # LINE Messaging + LIFF SDK wrapper [P2]
│   ├── email/               # React Email templates + Resend wrapper
│   ├── ui/                  # shadcn components shared
│   # admin auth = Auth.js v5 in apps/admin/auth.ts (no shared pkg)
│   # customer auth = packages/customer-auth (custom OAuth) [P1.5]
│   ├── themes/              # 5 storefront themes + shared section primitives
│   │   ├── shared/          # cross-theme: Cart, Checkout, base layouts
│   │   ├── minimal/
│   │   ├── classic/
│   │   ├── bold/
│   │   ├── showcase/
│   │   ├── boutique/
│   │   └── registry.ts      # export all themes for storefront
│   └── config/              # eslint, tsconfig, tailwind shared
├── docs/                    # this folder
├── .github/workflows/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### หลักการแยก

- `db` = single source of truth สำหรับ schema/types
- `core` = business logic ที่ใช้ทั้ง storefront, admin, workers — เปลี่ยนที่เดียว
- `beam` ห่อ API ของ Beam ไม่ให้กระจายทั้ง repo (ง่ายต่อการเปลี่ยน gateway อนาคต)
- `email` รวม template ที่เดียว, dev preview ผ่าน react-email server

### เริ่มต้นแค่
- `apps/storefront`, `apps/admin`
- `packages/db`, `packages/core`
- เพิ่ม package อื่นเมื่อเริ่ม duplicate

---

## Cost Estimate (MVP, 10–100 shops)

| Service | Cost/mo |
|---|---|
| Railway — 2 Next services + Postgres (Hobby/Pro starter) | ~$10–25 |
| Cloudflare Workers Paid (r2-proxy) | $5 |
| Cloudflare R2 | ~$1–3 |
| Cloudflare for SaaS hostnames | $0 (100 free) |
| Resend | $0 (free tier 3k email/mo) |
| Sentry | $0 (Developer plan) |
| Domain | ~$1 |
| **Total** | **~$20–40/mo** |

---

## Constraints & Risks

### Technical
1. **Railway region** — ตอนนี้มี US/EU/SG; เลือก SG ใกล้ผู้ใช้ไทย, Postgres ต้องอยู่ region เดียวกัน
2. **No edge** — apps เป็น Node long-running; latency ไกล user ต่างทวีปสูงกว่า CF Workers (offset ด้วย CF CDN ที่ static assets)
3. **Postgres connections** — postgres-js + `max: 10` per service เพียงพอตอน MVP; scale → เพิ่ม pgbouncer/PgCat
4. **App layer authz** — แทน Supabase RLS, ต้องเช็ค membership/ownership ใน Server Actions ทุก mutation
5. **Auth.js + Next 16** — peer dep ยังเตือน (beta.29 ระบุ next ^14/^15) แต่ runtime ใช้ได้

### Business
1. **Beam ไม่มี marketplace** — onboarding ต้องให้ร้านสมัคร Beam เอง, slow time-to-launch
2. **เก็บค่าธรรมเนียมแพลตฟอร์ม** — ทำได้แค่ subscription model
3. **Race condition inventory** — ต้องใช้ `SELECT FOR UPDATE` ใน checkout transaction

### Compliance
1. **PDPA (ไทย)** — encrypt PII at rest, audit logs
2. **PCI-DSS** — ห้ามเก็บ PAN; ใช้ Beam tokenization เท่านั้น
3. **GDPR** — ถ้าเปิดให้ร้านขายต่างประเทศ
