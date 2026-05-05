# Architecture Decision Log

บันทึกการตัดสินใจเชิงสถาปัตยกรรมตามลำดับเวลา (ADR-style แบบเบาๆ)

แต่ละ entry: **บริบท → ทางเลือก → ตัดสินใจ → ผลกระทบ**

---

## ADR-001: Hosting platform — Cloudflare Workers (NOT Vercel)

**Date:** 2026-05-05
**Status:** Accepted

**Context:** ต้องเลือก serverless platform สำหรับ Next.js 16

**Options considered:**
- Vercel — DX ดีสุด, native Next.js
- Cloudflare Workers (ผ่าน OpenNext) — egress ฟรี, edge-first, integrate กับ R2/Queues/KV ดี
- Self-host (Coolify/Railway) — flexible แต่ต้องดูแล infra

**Decision:** **Cloudflare Workers** ผ่าน `@opennextjs/cloudflare`

**Rationale:**
- อยู่ใน CF ecosystem ครบ (R2, Queues, KV, Hyperdrive, Custom Hostnames) → ลด vendor
- R2 egress ฟรี — สำคัญมากสำหรับ e-commerce ที่มีรูปสินค้าเยอะ
- Workers ราคาถูกกว่า Vercel เมื่อ scale

**Consequences:**
- ต้องใช้ edge-compatible packages เท่านั้น (no `fs`, no native `sharp`, no `bcrypt`)
- ใช้ `bcryptjs` หรือ Web Crypto API
- Image optimization ต้องผ่าน Cloudflare Images / Image Resizing
- ISR cache ผ่าน R2 + KV (OpenNext จัดให้)

---

## ADR-002: Multi-tenancy — Shared schema + RLS

**Date:** 2026-05-05
**Status:** Accepted

**Context:** ต้องเก็บข้อมูลของ N ร้านในระบบเดียว

**Options:**
- Database-per-tenant — isolation สูงสุด, migration นรก
- Schema-per-tenant — กลาง, migration ลำบากเมื่อ 500+ ร้าน
- Shared schema + `shop_id` + RLS — flexible สุด, ต้อง test RLS อย่างละเอียด

**Decision:** **Shared schema + RLS** ทุกตารางมี `shop_id`

**Rationale:** scale ดีถึงระดับหมื่นร้านโดยไม่ต้อง refactor

**Consequences:**
- ต้องเขียน RLS policy ทุกตาราง
- ต้องมี pgTAP test suite สำหรับ RLS
- Worker / queue consumer ใช้ service role + ตั้ง `app.current_shop_id` setting เอง

---

## ADR-003: Payment gateway — Beamcheckout

**Date:** 2026-05-05
**Status:** Accepted with limitations

**Context:** ต้องการ payment gateway สำหรับตลาดไทย รองรับ PromptPay + บัตรเครดิต + Mobile Banking

**Decision:** **Beamcheckout** (Hosted Payment Links + Webhook)

**Limitations พบจาก docs:**
- ❌ ไม่มี marketplace/sub-merchant API (เหมือน Stripe Connect)
- ❌ ไม่มี native subscription/recurring billing
- ✅ มี Card Tokenization + Network Tokenization → ทำ recurring เองได้

**Consequences:**
- ทุกร้านต้องสมัคร Beam merchant account ของตัวเอง — onboarding ช้าลง
- เก็บ API key per shop ใน Supabase Vault (encrypted)
- เก็บค่าธรรมเนียมแพลตฟอร์มเป็น **subscription fee** เท่านั้น (ไม่ take application fee)
- ติดต่อ Beam เรื่อง platform partnership ในภายหลัง (optional)

---

## ADR-004: Monetization model — Subscription only

**Date:** 2026-05-05
**Status:** Accepted

**Context:** Beam ไม่รองรับ split payment / application fee

**Decision:** เก็บค่าธรรมเนียมเป็น **monthly/yearly subscription** เท่านั้น (เหมือน Wix, Squarespace)

**Consequences:**
- ต้องมีระบบ subscription billing ของแพลตฟอร์มเอง (charge เจ้าของร้านรายเดือน)
- Plans + features differentiation สำคัญ (free trial, basic, pro, enterprise)
- ไม่มีรายได้ตามยอดขายของร้าน — ต้องวาง pricing tier ให้ครอบคลุม

---

## ADR-005: ORM — Drizzle (NOT Prisma)

**Date:** 2026-05-05
**Status:** Accepted

**Context:** ต้องใช้ ORM ที่ทำงานดีบน Cloudflare Workers

**Decision:** **Drizzle** + `postgres-js` driver via Hyperdrive

**Rationale:**
- Edge-compatible (Prisma ก็ได้แต่หนักกว่า)
- Type-safe เต็มที่, schema-as-code
- Bundle size เล็ก
- Migration ผ่าน `drizzle-kit` ตรงไปตรงมา

**Setup notes:**
- `prepare: false` เมื่อใช้กับ Supavisor transaction mode
- Connection ผ่าน `env.HYPERDRIVE.connectionString`

---

## ADR-006: Queue — Cloudflare Queues (NOT Inngest)

**Date:** 2026-05-05
**Status:** Accepted

**Context:** ต้องการ queue สำหรับ webhook delivery, email, image processing

**Decision:** **Cloudflare Queues** เริ่มต้น

**Trade-off ที่ยอม:**
- ❌ ไม่มี durable workflow (multi-step + sleep + waitForEvent) เหมือน Inngest
- ✅ อยู่ใน CF ecosystem, รวมใน Workers Paid plan ($5/mo)

**Future:** ถ้าต้อง workflow แบบ "ส่ง email → รอ 1 วัน → ถ้ายังไม่จ่าย → ส่งเตือน" → ใช้ **Cloudflare Workflows** (durable execution บน CF) แทน Inngest

---

## ADR-007: Image pipeline — Pre-generate 3 fixed variants at upload

**Date:** 2026-05-05
**Status:** Accepted

**Context:** ต้องการ image optimization บนแพลตฟอร์ม e-commerce ที่มีรูปสินค้าเยอะ; ไม่อยากใช้ Cloudflare Images เป็น CDN (lock-in + cost)

**Options considered:**
- A. Cloudflare Images เป็น CDN — lock-in, จ่ายตามจำนวน image stored + delivery
- B. On-demand resize ผ่าน Worker + cache ใน R2 — flexible แต่ซับซ้อน, ต้องจัดการ abuse
- C. Pre-generate fixed sizes ตอน upload, เก็บใน R2, serve ตรง — เรียบง่าย, ต้นทุนคาดเดาได้

**Decision:** **C** — generate 3 variants ตอน upload เท่านั้น

| Variant | Width | Purpose |
|---|---|---|
| `low` | 400px | thumbnail, cart, search |
| `mid` | 800px | listing, mobile product detail |
| `high` | 1600px | desktop product detail, zoom |

Format = WebP, quality = 85, fit = scale-down

**Rationale:**
- R2 egress ฟรี — serve รูปไม่จำกัดโดยไม่บวกค่าใช้จ่าย
- 3 ขนาดครอบคลุม use case 99% ของ e-commerce
- ไม่มี Worker ใน critical path ของการเสิร์ฟรูป → latency ต่ำ
- ไม่ต้องคิด whitelist / abuse vector
- Cost คาดเดาได้ ($1.50 / 1k รูป upload)

**Consequences:**
- ถ้าอนาคตอยากเพิ่ม variant (เช่น `xlarge` 2400px) → ต้อง batch backfill รูปเก่าทั้งหมด
- ไม่รองรับ format negotiation per browser (AVIF) — ใช้ WebP fallback ทั่วไปก็พอใน 2026
- URL pattern: `cdn.yourapp.com/shops/{shop_id}/img/{uuid}/{low|mid|high}.webp`

**Superseded:** ADR-007 เดิมที่บอกว่าจะมี phase 2 เป็น on-demand cache — **ตัดทิ้ง**, ไม่ทำแล้ว

---

## ADR-008: Repo structure — Monorepo with separated storefront + admin

**Date:** 2026-05-05
**Status:** Accepted

**Context:** ต้องเลือกระหว่าง single Next.js app vs separated apps

**Decision:** **pnpm + Turborepo monorepo** กับ:
- `apps/storefront` (custom domain)
- `apps/admin` (admin.yourapp.com)
- `apps/workers/*` (queue consumers, cron, image-resolver)
- `packages/{db,core,beam,email,ui,auth,config}`

**Rationale:**
- Storefront และ admin มี perf characteristic ต่างกัน (ISR vs CSR)
- Deploy แยก, scale แยก, security boundary ชัด
- Shared schema/business logic ผ่าน `packages/`

**Consequences:**
- Setup tooling ครั้งแรกซับซ้อนกว่า single app
- Build cache ผ่าน Turbo สำคัญ — ห้ามลืมตั้ง

---

## ADR-009: Custom domain — Cloudflare for SaaS

**Date:** 2026-05-05
**Status:** Accepted

**Context:** ลูกค้าต้องชี้ custom domain มา + ต้องการ SSL อัตโนมัติ

**Decision:** **Cloudflare for SaaS** (Custom Hostnames API)

**Rationale:**
- Issue + renew SSL อัตโนมัติ
- ไม่จำกัด hostname (cost ต่อ hostname ต่ำ)
- API ครบ + มี webhook notification

**Detail:** ดู `docs/CUSTOM-DOMAIN.md`

---

## ADR-010: CRM + Loyalty system — Phased ledger-based design

**Date:** 2026-05-05
**Status:** Accepted

**Context:** ต้องการระบบ CRM + สะสมแต้ม. Scope กว้างมาก (groups, points, tiers, referrals, segments, automations) — ต้องตัดสินใจว่าทำเฟสไหน + design pattern พื้นฐาน

**Decision:**

**Scope split:**
- **MVP:** customer groups + notes, single loyalty program/ร้าน, earn-on-paid + redeem-as-discount, append-only ledger
- **P2:** tiers, signup/birthday bonus, referral, review-earn, customer events timeline, email campaigns
- **P3:** marketing automation (CF Workflows), dynamic segments

**Core patterns ที่ลงล็อก:**

1. **Ledger pattern** — `loyalty_ledger` append-only ห้าม UPDATE/DELETE (Postgres RULE บังคับ); `customer_loyalty.points_balance` เป็น cache คำนวณจาก ledger; nightly reconciliation cron กัน drift

2. **Redemption แยกจาก discounts** — ตาราง `loyalty_redemptions` ผูกกับ cart/order ตรง ไม่ผ่าน rule engine ของ discount เพราะ semantics ต่างกัน (balance deduction ไม่ใช่ rule)

3. **Earn timing = order paid** — ไม่ใช่ตอนสร้าง order (กัน fraud + abandoned). Trigger ผ่าน Beam webhook → CF Queue `loyalty-earn`

4. **Point precision = int** — 1 คะแนน = หน่วยเล็กที่สุด, ห้าม fractional

5. **Expiry = balance-level (MVP)** — sum ของ earn ที่ expires_at < now หักครั้งเดียว ไม่ track FIFO consumption (FIFO = P2 ถ้าจำเป็น)

6. **Concurrency = SELECT FOR UPDATE บน customer_loyalty** ในทุก transaction ที่แตะ balance

**Rationale:**
- Ledger pattern จำเป็นสำหรับ audit + finance reconciliation + กัน race
- แยก redemption จาก discount เพราะถ้ายัดรวม จะ bloat discount engine และยากต่อการ reverse ตอน refund
- Earn-on-paid เป็น industry standard, กันการให้แต้มผิด

**Consequences:**
- เพิ่ม 8 ตารางใน DB (5 MVP, 3 P2)
- เพิ่ม 2 queue + 3 cron triggers
- เพิ่ม `packages/core/loyalty` + `packages/core/crm`
- Order schema เพิ่ม 3 fields: `loyalty_points_earned`, `loyalty_points_redeemed`, `loyalty_amount_redeemed`
- ทุก order paid event ต้อง enqueue `loyalty-earn` — เพิ่ม dependency
- Refund flow ซับซ้อนขึ้น (ต้อง reverse earn + redeem)

---

## ADR-011: Customer auth — Multi-provider with platform-level OAuth

**Date:** 2026-05-05
**Status:** Accepted

**Context:** ลูกค้าใน storefront ต้องการ login หลายแบบ — ต่างจาก admin auth ที่ใช้ Supabase Auth ตรงๆ

**Decision:**

**Customer auth = custom flow แยกจาก Supabase Auth**, รองรับ provider:
| Provider | Phase | Credentials |
|---|---|---|
| Email magic link | MVP | platform-level (Resend) |
| Google OAuth | MVP | platform-level (1 OAuth app กลาง) |
| Facebook OAuth | MVP | platform-level (1 OAuth app กลาง) |
| LINE Login | P2 | per-shop (channel ของแต่ละร้าน) |

Per-shop เปิด/ปิด provider ผ่าน `shop_auth_settings`

Identity model: 1 customer → N `customer_identities` (link หลาย provider เข้าด้วยกัน)

Session: custom JWT signed ด้วย platform secret, เก็บใน httpOnly cookie ของ shop domain, มี `customer_sessions` revocation list

**Rationale:**
- Customer identity = scoped per-shop (email เดียวกันที่ร้าน A กับ B = คนละ entity) → Supabase Auth (global users) ไม่ fit
- Platform-level OAuth = simple onboarding (ร้านไม่ต้องสร้าง OAuth app เอง), brand แสดง "PipeCommerce" บน consent screen ก็ acceptable
- LINE = per-shop เพราะ userId ผูกกับ channel + ทุกร้านมี OA ของตัวเองอยู่แล้ว

**Consequences:**
- ต้องเขียน OAuth flow เอง (Google, Facebook ใน MVP, LINE ใน P2)
- ต้องเก็บ `customer_identities`, `customer_sessions` table
- Identity merge เมื่อ email ซ้ำ → ต้อง prompt user (ห้าม auto-merge เพื่อกัน account takeover)
- LINE userId ที่ link ใน `customer_line_identities` เก็บแยกเพราะมีข้อมูลเฉพาะ (is_following, opt-in flags)

---

## ADR-012: LINE Integration — Phase 2, LIFF as separate app

**Date:** 2026-05-05
**Status:** Accepted (deferred to P2)

**Context:** ตลาดไทยใช้ LINE หนักมาก ลูกค้ามักคาดหวัง LIFF storefront + push notification ผ่าน LINE chat

**Scope decisions:**

**Phase 2 (in scope):**
- LINE Login provider (เพิ่มจาก ADR-011)
- LIFF storefront — **`apps/storefront-liff` แยกจาก `apps/storefront`**
- Per-shop channel + multiple LIFF apps config
- Webhook handler (follow/unfollow/message events)
- Push notification ผ่าน Messaging API
- Rich Menu management

**Phase 3 (deferred):**
- Broadcast/segment campaign UI
- Bot auto-reply / chatflow
- LINE Pay (ใช้ Beam อย่างเดียว)

**Out of scope (ไม่ทำ):**
- Marketplace LINE channel (ทุกร้านมี OA ของตัวเอง — เหมือน Beam)

**Push notification events ที่ต้องการ (confirmed):**
- `order.paid` — ใบเสร็จ + tracking
- `loyalty.points_earned` — แจ้งแต้มที่ได้

**Implementation pattern:**
- Domain event → enqueue `line-push` (CF Queue) → consumer load shop's access token → call Messaging API → log ใน `line_messages`
- Quiet hours 22:00–08:00, opt-in per channel (transactional vs marketing แยก), frequency cap

**Rationale (LIFF แยก app):**
- UX ต่างกัน — LIFF อยู่ใน WebView ของ LINE, mobile-first, ไม่มี SEO
- Bundle ต่างกัน — มี LIFF SDK, ไม่ต้อง ISR/marketing components
- Auth flow ต่างกัน — LIFF token verify ตรงผ่าน LINE JWKS, ไม่ผ่าน OAuth redirect
- Deploy แยก scale แยก — campaign push spike ไม่กระทบ storefront

**Rationale (per-shop channel):**
- LINE userId ผูกกับ channel — share channel ข้ามร้านไม่ได้ทาง technical
- เจ้าของร้านควบคุม brand + cost (LINE OA plan) ของตัวเอง

**Consequences:**
- เพิ่ม 6 ตาราง: `shop_line_channels`, `shop_liff_apps`, `customer_line_identities`, `shop_line_rich_menus`, `line_messages`, `line_audiences`
- เพิ่ม 2 queue: `line-push`, `line-webhook`
- เพิ่ม `apps/storefront-liff` + `packages/line` + `packages/core/notifications`
- Onboarding ของร้านยาวขึ้น (ต้องสมัคร LINE OA + สร้าง LIFF app เอง)
- ต้อง compliance LINE ToS + PDPA (opt-in, quiet hours, frequency cap)
- Phase 1 จะใช้ email อย่างเดียวสำหรับ notification

---

## ADR-013: Theme system — 5 themes + drag-drop builder in MVP

**Date:** 2026-05-05
**Status:** Accepted

**Context:** Storefront ของแต่ละร้านต้องปรับแต่งได้ — เลือก theme, แก้สี, ใส่ logo, จัดเรียงเนื้อหา

**Options considered:**
- A. Theme config JSON (form-only, fixed layout per theme) — ง่ายสุด, flexibility ต่ำ
- B. Liquid-style template engine (เหมือน Shopify) — flexible สูงสุด, engineering หนักมาก
- C. Pre-built React themes + form-based editor — สมดุล
- D. Pre-built React themes + **drag-drop visual builder** — UX ดีสุด, engineering หนัก

**Decision:** **D — Pre-built themes + drag-drop builder**

**Scope MVP:**
- 5 themes: `minimal`, `classic`, `bold`, `showcase`, `boutique`
- Global settings: colors, typography, header style, footer style, layout
- Section reorder + add/remove บน **home page** เท่านั้น (collection/product locked)
- Drag-drop visual editor พร้อม iframe live preview
- Logo / favicon / section image upload (ผ่าน R2 pipeline เดียวกับ product image)
- Auto-save draft + manual publish

**Phase 2:**
- Section editing บน collection/product pages
- Draft/publish version history
- Custom CSS field (sanitized)
- เพิ่ม theme เป็น 8–10 ตัว

**Phase 3:**
- Custom theme upload (.zip)
- Theme marketplace

**Rationale:**
- Drag-drop = UX ที่ shop owner คาดหวังในยุคนี้ (Wix, Squarespace, Shopify 2.0 ทำหมด) — ถ้าทำ form-only ใน MVP จะรู้สึกล้าหลัง
- 5 themes ใน MVP = ครอบคลุม use case หลัก ไม่ต้องรอ P2
- Lock product/collection ใน MVP = ตัด complexity ของ section schema cross-page; home page coverage 80% ของ branding

**Technical decisions:**
- `@dnd-kit/core` + `@dnd-kit/sortable` สำหรับ drag-drop
- iframe preview load storefront URL พร้อม `?theme_draft=<token>` (token ใน `theme_draft_tokens`, expires 1 hour)
- postMessage protocol: `editor → iframe` ส่ง state update; `iframe → editor` ส่ง section selected event
- Auto-save draft ทุก 5 วิ
- Publish = atomic copy `draft_*` → published columns + revalidate cache tag `shop:{id}:storefront`
- Theme bundles ใช้ dynamic import — load เฉพาะ theme ที่ shop ใช้
- Theme version pin ที่ `shop_theme_settings.theme_version` — upgrade ต้อง explicit (กัน schema drift)

**Consequences:**
- **Engineering หนักขึ้นเทียบกับ form-only ~3–4x** — drag-drop builder + iframe communication + draft state + 5 themes (design + implement)
- ต้องมี design resource สำหรับ 5 themes (ไม่ใช่แค่ dev)
- Schema migration ทุกครั้งที่ theme schema เปลี่ยน → ต้อง bump theme version + migration script
- Draft mode ใน storefront = ปิด ISR cache ตอน preview → ต้อง dynamic SSR ผ่าน token check

**Mitigation:**
- เริ่มที่ 1–2 themes ทำให้ดี, scale ไป 5 ก่อน MVP launch (อาจ launch beta ที่ 3 ก่อน)
- ใช้ shadcn/ui form-builder pattern สำหรับ settings panel เพื่อลดงาน (auto-generate UI จาก schema)

---

## ADR-014: Storefront SEO — Tools, sitemap, structured data

**Date:** 2026-05-05
**Status:** Accepted (placeholder — design pending)

**Context:** ร้านค้าต้องการให้สินค้าติด Google. ต้องมีเครื่องมือ SEO ในระบบครบ

**Decision:** Built-in SEO tooling เป็น first-class feature ของ storefront — ดูรายละเอียดที่ [docs/SEO.md](SEO.md)

**Scope MVP:**
- Per-resource SEO fields (title, description, canonical) — มีใน schema อยู่แล้ว
- `sitemap.xml` (auto, dynamic per shop)
- `robots.txt` (per shop, configurable)
- JSON-LD structured data: Product, Organization, BreadcrumbList, Offer, AggregateRating (P2)
- Open Graph + Twitter card meta auto-generated
- Canonical URLs (จัดการ custom domain vs default subdomain)
- 301 redirect manager (ร้านย้าย URL)
- Image alt text บังคับ (UI nudge)

**Phase 2:**
- Review/Rating + AggregateRating schema
- FAQPage schema
- hreflang (ถ้ามี multi-locale)
- Search Console verification helper
- Page speed insights ใน admin
- Internal linking suggestions

**Phase 3:**
- Auto SEO content suggestions (AI-generated meta)
- A/B test meta titles
- Schema testing tool

**Rationale:**
- SEO เป็น make-or-break สำหรับ e-commerce — ถ้าทำหลังจะลำบาก (URL structure, redirect, schema คิดเร็วๆ ตอนต้นง่ายกว่า)
- structured data + sitemap = low-hanging fruit ที่กระทบ ranking ตรงๆ
- แยกเอกสาร [SEO.md](SEO.md) เพราะรายละเอียดเยอะ

**Consequences:**
- เพิ่ม route `/sitemap.xml`, `/robots.txt` ใน storefront
- เพิ่มตาราง `seo_redirects` (301 manager)
- ทุก product/collection page ต้อง emit JSON-LD ในตัว theme
- ต้อง enforce canonical URL — ถ้า shop มีทั้ง subdomain + custom domain ใช้ custom เป็น canonical

---

## ADR-015: External integrations — Defer to Phase 3+, with MVP groundwork

**Date:** 2026-05-05
**Status:** Accepted (deferred)

**Context:** ลูกค้าจะอยากให้ระบบเชื่อมกับ shipping (Shippop), accounting (FlowAccount), marketplaces (Lazada/Shopee), analytics (GA4) ฯลฯ — แต่ scope ใหญ่มากและไม่ block MVP

**Decision:** **เลื่อน external integrations ทั้งหมดไป Phase 3+** ยกเว้น analytics pixels (GA4/Meta/TikTok) ที่ทำใน P2

**MVP groundwork (ทำให้พอ ไม่ขยาย scope):**
- ✅ Outbound webhooks (`webhooks` + `webhook_deliveries`) — ลูกค้า subscribe event ได้
- ✅ Domain event pattern (extensible)
- ✅ Audit logs
- ✅ Per-shop Vault สำหรับ credential
- ✅ API versioning prefix `/api/v1/` ตั้งแต่ต้น (กัน breaking change)

**Phase 3 scope:**
- Public REST API + Personal Access Tokens (PAT)
- Public OAuth2 (third-party apps)
- Inbound signed webhooks
- Shipping: Shippop/Shipnity
- Accounting: FlowAccount/PEAK/Xero
- Marketplace: Lazada/Shopee
- Email marketing: Mailchimp/Klaviyo
- Automation: Zapier/n8n
- ERP (Odoo, SAP) เมื่อมี enterprise customer

**Phase 2 (เอามาก่อน — low effort, high value):**
- GA4, Meta Pixel, TikTok Pixel — แค่ inject script tag ผ่าน theme settings

**Out of scope (ไม่ทำ):**
- Shopify-style "App Store" / public marketplace ของ third-party app — เริ่มที่ first-party integrations ก่อน

**Rationale:**
- MVP focus = ทำ core commerce + theme + custom domain + loyalty ให้ดีก่อน
- External integrations มี maintenance burden สูง (API change, rate limit, error handling per provider)
- Outbound webhooks ใน MVP เปิดทางให้ลูกค้าหรือเรา build connector ภายนอกได้ก่อน (Zapier/n8n รับ webhook ได้)

**Consequences:**
- ต้อง educate ลูกค้าว่า "ตอนนี้ใช้ webhook + Zapier ได้ก่อน" ระหว่างรอ native integration
- Architecture decisions ต้องคิดเผื่อ (API versioning, idempotency, signature) ตั้งแต่ MVP — ไม่งั้น refactor หนักทีหลัง
- เพิ่ม `packages/integrations/{name}` pattern เมื่อถึง P3 — ไม่ปนกับ `core`

---

## ADR-016: Additional MVP features — Search, Tax, Account, Tracking, CSV, AnnouncementBar, Newsletter

**Date:** 2026-05-05
**Status:** Accepted

**Context:** หลังจากวาง core architecture เสร็จ ทบทวนว่ามี Shopify-equivalent features อะไรที่ต้องอยู่ใน MVP เพื่อให้ "ใช้งานจริง" ได้

**Decision:** เพิ่ม 7 features ลง MVP:

### 1. Search + Faceted Filter
- Engine: **Postgres FTS + pg_trgm** (รองรับ Thai fuzzy match)
- เปิด extension `pg_trgm` + `unaccent`
- `products.search_vector` GENERATED column + GIN index
- Facets: price range, tags, variant options, availability — pre-aggregate cache ใน KV 5 นาที
- Engine swap-able: `packages/core/search/{provider}.ts` — อนาคตย้ายไป Meilisearch/Typesense ได้

### 2. Tax Calculation
- Per-shop config: `prices_include_tax` (Thailand mode = inclusive default)
- Default rate 7% (VAT), เพิ่ม `tax_rates` table สำหรับ multi-region
- Tax-exempt customer groups (P2 B2B feature)
- Snapshot ใน `order_line_items.tax_lines` ตอนสร้าง order

### 3. Customer Self-Service Portal
- Routes: `/account/{orders, addresses, profile, loyalty}`
- ใช้ customer JWT จาก ADR-011
- Server-side filter ด้วย `customer_id` (bypass RLS, explicit filter ตรงไปตรงมา)

### 4. Order Tracking Page (Public)
- เพิ่ม `orders.tracking_token` (32-char random opaque, unique)
- URL: `{shop-domain}/orders/{order_number}?token={tracking_token}`
- ส่งใน confirmation email + shipping notification + LINE push (P2)
- Rate limit per IP กัน enumeration; ไม่แสดง PII แม้ token ถูก

### 5. Bulk CSV Import/Export
- Resources MVP: products, customers, inventory, discounts (export-only: orders)
- Format = Shopify-compatible (import จาก Shopify ได้ตรง)
- Architecture: upload → R2 → enqueue `bulk-import` → consumer chunk 100 rows/transaction → progress polling
- ตาราง `bulk_jobs` สำหรับ status tracking
- Image import: download URL → upload R2 → enqueue image-process

### 6. Announcement Bar
- Theme component: rotating message + countdown + dismissible
- Schedule (starts_at/ends_at), targeting (all/home_only/exclude_checkout)
- Dismiss = client cookie (ไม่ track per-user)
- ตาราง `shop_announcement_bars`

### 7. Newsletter Signup
- ตาราง `newsletter_subscribers` พร้อม PDPA consent fields (ip, ua, consent_text)
- 1-click unsubscribe ผ่าน HMAC token
- Source tracking (footer | popup[P2] | checkout | manual_import)
- ใน MVP: เก็บ list + welcome email; campaign builder = P2

**Out of MVP scope (ตามที่ตัดสิน):**
- Product reviews → P2
- Wishlist, gift cards, bundles, pre-order, digital products → P2
- Pop-up forms (exit intent) → P2
- Subscription / recurring orders → P2

**Rationale:**
- 5 must-have = "credibility floor" สำหรับ e-commerce platform จริง — ไม่มี = ใช้งานไม่ได้
- 2 marketing features (announcement bar + newsletter) = effort ต่ำ + value สูง + ผูกกับ theme system อยู่แล้ว
- Product reviews เลื่อนเพราะกระทบทั้ง storefront + admin + moderation flow + spam protection — scope ใหญ่ ทำใน P2 พร้อม Q&A

**Consequences:**
- เพิ่ม ~7 ตารางใหม่: `tax_rates`, `bulk_jobs`, `shop_announcement_bars`, `newsletter_subscribers` + fields ใน `products` (search_vector), `orders` (tracking_token)
- เพิ่ม 3 queue: `bulk-import`, `bulk-export`, `abandoned-cart`
- เพิ่ม 3 sub-package ใน core: `tax`, `search`, `bulk`
- ต้องเปิด Postgres extensions: `pg_trgm`, `unaccent`
- Lighthouse CI gate ต้องผ่านแม้มี announcement bar (no layout shift)
- PDPA: newsletter subscribers ต้องเก็บ consent log + 1-click unsubscribe

---

## ADR-017: Reports & Analytics — 3-layer architecture with daily snapshot

**Date:** 2026-05-05
**Status:** Accepted

**Context:** ร้านค้าต้องการเห็นยอดขาย, top products, tax collected, etc. ทั้งใน dashboard, download CSV, และอยากให้ส่ง report ทาง email

**Decision:** **3-layer reports architecture:**

1. **Live SQL aggregation** — ad-hoc range, query สด, cache 1 min ใน edge KV
2. **Pre-aggregated daily snapshot** (`report_snapshots_daily`) — cron compute วันละครั้ง, dashboard โหลด instant
3. **Scheduled email digest** — daily/weekly/monthly ตาม `report_email_subscriptions`

**Reports MVP (9 ตัว):**
- Sales overview, sales by product/variant, sales by collection
- Top customers, discount usage
- **Tax collected** (สำหรับ ภงด.50 / ภพ.30 ของไทย — สำคัญ)
- Inventory snapshot + low-stock alert
- Refunds, loyalty earned/redeemed

**CSV download** ใช้ pipeline เดียวกับ `bulk_jobs` (resource = `'report_xxx'`)

**Email rendering:** React Email + Resend, template ใน `packages/email/templates/reports/`

**Cron schedule (ICT):**
- 02:00 ทุกวัน — compute daily snapshot
- 08:00 ทุกวัน — daily digest emails
- 08:00 จันทร์ — weekly digest
- 08:00 วันที่ 1 — monthly digest

**Recompute policy:** ถ้า admin แก้ order ย้อนหลัง (refund, cancel) → enqueue `recompute-snapshot` สำหรับ shop+date เก่า

**Rationale:**
- Live SQL พอใช้ได้จนถึง ~10K orders/shop — over-engineer ตั้งแต่แรกไม่จำเป็น
- Snapshot สำหรับ dashboard หน้าแรก = UX critical (ห้ามรอ 5 วิ)
- Email digest = high-value low-effort, shop owner ดู mobile ได้
- ไม่ใช้ OLAP/data warehouse (Snowflake, ClickHouse) — Postgres เพียงพอจน scale มาก
- ไม่สร้างตาราง `report_csv_exports` แยก — ใช้ `bulk_jobs.resource = 'report_xxx'` ลด complexity

**Consequences:**
- เพิ่ม 2 ตาราง: `report_snapshots_daily`, `report_email_subscriptions`
- เพิ่ม 4 cron triggers
- เพิ่ม `packages/core/reports/`
- เพิ่ม React Email templates สำหรับ digest
- ต้องระวัง snapshot drift เมื่อ admin แก้ order ย้อนหลัง — ต้อง enqueue recompute

**Phase 2 reports (deferred):**
- Cohort analysis (LTV by signup month)
- Traffic source / conversion funnel (รอ pixel integration)
- Abandoned cart performance
- Product velocity / sell-through

---

## ADR-018: Tax modes — 3 options instead of 2 (supersedes ADR-016 tax part)

**Date:** 2026-05-05
**Status:** Accepted (supersedes tax design ใน ADR-016)

**Context:** ADR-016 ออกแบบ tax เป็น `prices_include_tax: boolean` — แค่ 2 mode (inclusive/exclusive) ไม่รองรับ "ร้านดูดซับ VAT"

**Decision:** **เปลี่ยนเป็น 3 modes** ใน `shops.settings.tax.mode`:

| Mode | Customer พบ | ร้านได้ | VAT ส่งรัฐ |
|---|---|---|---|
| `inclusive_customer` (default ไทย) | ราคารวม VAT | price - VAT | จาก customer |
| `exclusive_customer` | ราคา + VAT ตอน checkout | price | จาก customer |
| `shop_absorbs` | ราคาเรียบ ไม่บวก | price - VAT | **จาก revenue ของร้าน** |

**Math (rate 7%):**
```
inclusive:  pay=107, net=100, tax=7
exclusive:  pay=107 (100+7), net=100, tax=7
absorbs:    pay=100, net=~93.46, tax=~6.54  ← back out จากราคารวม
```

`shop_absorbs` math = back-calculate VAT จากราคา (กฎหมายไทยถือว่าราคารวม VAT แล้วเสมอถ้าจด VAT)

**Snapshot ใน `order_line_items.tax_lines`:**
```jsonc
{ "rate": 0.07, "name": "VAT", "amount": ..., "mode": "...", "absorbed_by_shop": false|true }
```

**Receipt display:**
- inclusive — แสดง tax included
- exclusive — แสดง tax เพิ่ม
- absorbs — ไม่แสดง tax (avoid customer สับสน) แต่ admin/report เห็นครบ

**Reports:**
- `total_tax_collected` (จาก customer) ≠ `total_tax_owed` (ส่งรัฐ) ใน mode `shop_absorbs`
- ทุก report ต้องแยก 2 ตัวเลขนี้

**Rationale:**
- `shop_absorbs` เป็น use case จริงในตลาดไทย (ร้านอยากเสนอราคาเรียบ ลด margin เอง — โดยเฉพาะ promo/sale)
- ถ้าไม่รองรับ shop จะใส่ราคาผิดเอง เลี่ยง VAT แล้วโดน revenue dept

**Consequences:**
- Tax engine ใน `packages/core/tax/` ต้อง implement 3 paths แทน 2
- Reports table แยก `total_tax_collected` vs `total_tax_owed`
- UI ใน admin settings ต้องอธิบาย 3 mode ให้ shop เข้าใจ (มี example math)
- Migration: existing shops set default = `inclusive_customer`

---

## ADR-019: Content (articles + pages) — In MVP, single implicit blog per shop

**Date:** 2026-05-06
**Status:** Accepted

**Context:** ลืม include content feature ใน MVP scope ตอนวาง architecture (โผล่
ใน SEO.md เป็น P2 placeholder). แต่ Shopify-equivalent platform ไม่มีไม่ได้:
- pages = legal compliance (PDPA Privacy Policy, Terms, Refund Policy)
- articles/blog = SEO content + customer trust + ad-hoc news/announcements

**Decision:** เพิ่ม **3 ตาราง** ใน MVP:
- `articles` (FTS via `compute_article_search_vector` IMMUTABLE wrapper —
  pattern เดียวกับ products)
- `article_images` (R2 pipeline เดียวกับ product_images)
- `pages` (static, ไม่มี FTS)

**ไม่รวม:**
- `blogs` table (multi-blog per shop) — 1 implicit blog/shop ใน MVP, multi-blog
  เลื่อน P2 ถ้ามีลูกค้าต้องการ
- Comments — P2 (spam protection + moderation flow ต่างหาก)
- Categories table — ใช้ `tags text[]` แบบเดียวกับ products

**URL routing:**
- `/blog` — article list (paginated)
- `/blog/{article-handle}` — article detail
- `/pages/{page-handle}` — static page

**Theme integration:** ทุก theme ต้อง implement template:
- `BlogIndex` (list)
- `ArticleDetail` (single)
- `Page` (static rendered HTML)
+ theme.json schema เพิ่ม `templates.{blog_index, article, page}`

**SEO:**
- เพิ่ม `sitemap-articles.xml`, `sitemap-pages.xml` ใน sitemap index
- JSON-LD: `BlogPosting` (articles), `WebPage` (pages) emitted ผ่าน theme
- 301 redirect ใช้ `seo_redirects` ที่มีอยู่ — auto-create เมื่อ handle เปลี่ยน

**Search:** articles อยู่ใน main storefront search (FTS + pg_trgm).
pages ไม่อยู่ใน search — เป็น static reference ไม่ใช่ shoppable content

**Rationale:**
- 3 tables เพิ่มเล็ก, pattern reuse เกือบ 100% จาก products + product_images
- Single implicit blog = match mental model ของ shop owner ไทย ("section บทความ" ที่เดียว)
- Comments ตัดออกเพราะ moderation + spam = scope creep ที่ไม่จำเป็น MVP

**Consequences:**
- เพิ่ม 3 ตาราง + 1 IMMUTABLE function (`compute_article_search_vector`)
- เพิ่ม RLS policies (anon read active, authenticated shop-member ALL)
- Theme spec เพิ่ม template requirement — ทุก theme ใน MVP (5 ตัว) ต้อง support
- Sitemap + JSON-LD เพิ่ม content type
- Storefront route + admin CRUD UI เพิ่ม

---

## Template สำหรับ ADR ใหม่

```markdown
## ADR-XXX: <decision title>

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-YYY

**Context:** สถานการณ์/ปัญหาที่ต้องตัดสินใจ

**Options considered:**
- Option A — pro/con
- Option B — pro/con

**Decision:** เลือกอะไร

**Rationale:** ทำไม

**Consequences:** ผลกระทบที่ต้องยอมรับ
```
