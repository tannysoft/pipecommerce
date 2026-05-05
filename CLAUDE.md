# PipeCommerce

Multi-tenant SaaS e-commerce platform (Shopify-like). ลูกค้าสร้างร้าน, ขายสินค้า, จัดการคูปอง, ชี้ custom domain มาที่แพลตฟอร์มได้

## Documentation

อ่านเอกสารใน `docs/` ก่อนเริ่มงาน:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — tech stack, infra, monorepo structure, การตัดสินใจสำคัญ
- [docs/SCHEMA.md](docs/SCHEMA.md) — database schema design (PostgreSQL + Drizzle + RLS)
- [docs/CUSTOM-DOMAIN.md](docs/CUSTOM-DOMAIN.md) — custom domain + SSL flow ผ่าน Cloudflare for SaaS
- [docs/SEO.md](docs/SEO.md) — sitemap, structured data, redirects, meta tags
- [docs/DECISIONS.md](docs/DECISIONS.md) — log การตัดสินใจที่สำคัญ (ADR-style)

## Status

อยู่ในเฟส **architecture / planning** — ยังไม่มีโค้ด

## Quick reference

- **Stack:** Next.js 16 (App Router) บน Cloudflare Workers (OpenNext) + Supabase Postgres + Drizzle + R2 + CF Queues + Resend + Beamcheckout
- **Monorepo:** pnpm workspaces + Turborepo
- **Auth (admin):** Supabase Auth. **Auth (customer):** custom OAuth flow — Email magic link + Google + Facebook ใน MVP, LINE Login ใน P2
- **Features ใน MVP:** multi-tenant shops, custom domain, products/variants, cart/checkout, discounts (rule engine), customer groups, loyalty program (1/shop, ledger-based earn/redeem), 5 storefront themes + drag-drop builder (home page only), SEO tools (sitemap, JSON-LD, redirects), search + faceted filter (Postgres FTS + pg_trgm), **tax 3 modes (inclusive_customer / exclusive_customer / shop_absorbs)**, customer self-service portal (/account), public order tracking page, bulk CSV import/export (Shopify-compat format), announcement bar, newsletter signup (PDPA-compliant), **reports & analytics (live SQL + daily snapshot + scheduled email digest)**, **content (articles/blog + static pages with FTS)**
- **Phase 2:** LINE integration ครบก้อน (Login, LIFF storefront เป็น app แยก, channel/LIFF config per shop, push notification สำหรับ order.paid + loyalty.points_earned, rich menu, webhook follow/unfollow)
- **ห้ามใช้:** Vercel hosting, Node-only modules ที่ไม่ใช่ edge-compatible
- **ห้ามแก้:** `loyalty_ledger` ห้าม UPDATE/DELETE (append-only); `orders.*_price`, `order_line_items.price` เป็น snapshot ห้ามคำนวณใหม่จาก current product price
- **ห้าม auto-merge identities:** ถ้า customer login ด้วย provider ใหม่ที่ email ตรงกับ customer เดิม ต้อง prompt confirm (กัน account takeover)

## Conventions

- Code, identifiers, schema, file names = English
- Comments เฉพาะส่วนที่ "ทำไม" ไม่ชัด — ห้าม comment อธิบาย "อะไร"
- Communication กับ user = ภาษาไทย
