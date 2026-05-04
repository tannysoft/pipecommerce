# PipeCommerce

Multi-tenant SaaS e-commerce platform — Shopify-like, ตลาดไทย, custom domain ได้

## Status

🚧 **Phase 1 — Skeleton scaffolded** (ยังไม่ได้รัน install)

Architecture decisions ครบ ดู [docs/](./docs/):
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/SCHEMA.md](./docs/SCHEMA.md)
- [docs/CUSTOM-DOMAIN.md](./docs/CUSTOM-DOMAIN.md)
- [docs/SEO.md](./docs/SEO.md)
- [docs/DECISIONS.md](./docs/DECISIONS.md) — 18 ADRs

## Tech Stack (สรุป)

- **Framework:** Next.js 16 (App Router) + React 19
- **Hosting:** Cloudflare Workers via OpenNext
- **DB:** Supabase Postgres + Hyperdrive (pooler) + Drizzle ORM
- **Storage:** Cloudflare R2 (egress ฟรี)
- **Queue:** Cloudflare Queues
- **Email:** Resend
- **Payment:** Beamcheckout
- **Custom domains:** Cloudflare for SaaS
- **Monorepo:** pnpm + Turborepo

## Prerequisites

- Node.js **20+** (โปรเจ็คตั้ง `.nvmrc` = 22)
- pnpm 10+
- Cloudflare account (Workers Paid plan)
- Supabase project
- Beamcheckout merchant account (per shop)
- Resend account

## Setup (Phase 1)

```bash
# 1. Use correct Node version
nvm use

# 2. Install dependencies
pnpm install

# 3. Copy environment template
cp .env.example .env

# 4. Fill in DATABASE_URL (Supabase Postgres pooler URL) + other secrets

# 5. Generate + run initial migration
pnpm db:generate
pnpm db:migrate

# 6. Run dev servers
pnpm dev
# → storefront: http://localhost:3000
# → admin:      http://localhost:3001
```

## Project Structure

```
pipecommerce/
├── apps/
│   ├── storefront/        # Next.js 16 — public storefront (custom domain)
│   ├── admin/             # Next.js 16 — admin.pipecommerce.app
│   └── (workers/)         # Phase 2: queue consumers, cron, image-resolver
├── packages/
│   ├── config/            # shared tsconfig + tailwind preset
│   ├── db/                # Drizzle schema + client
│   └── (others — Phase 2)
└── docs/                  # architecture + decisions
```

## Phase Roadmap

- ✅ **Phase 1 — Skeleton:** monorepo + apps + db package + initial 4 schema tables
- ⏭️ **Phase 2 — Foundation:** full schema, migrations, ui package, auth (Supabase admin), CF bindings (R2/KV/Hyperdrive/Queues), middleware shop lookup
- ⏭️ **Phase 3+ — Features:** ทำตาม docs/ARCHITECTURE.md ทีละ section

## Convention

- Code, identifiers, schema = English
- Comments เฉพาะส่วนที่ "ทำไม" ไม่ชัด
- Communication = ภาษาไทย

## License

Private / proprietary.
