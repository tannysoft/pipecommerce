# AGENTS.md — PipeCommerce

คู่มือสำหรับ agents / contributors ที่เพิ่งเข้ามาในโปรเจกต์ — รวมทุกอย่างที่ควรรู้ก่อนแตะ code

> สำหรับเอกสารระดับ design ดูที่ `docs/` (ARCHITECTURE.md / SCHEMA.md / DECISIONS.md / RAILWAY.md / CUSTOM-DOMAIN.md / SEO.md)

---

## 1. ภาพรวมโปรเจกต์

PipeCommerce เป็น **SaaS e-commerce platform** แบบ Shopify-like สำหรับ SMEs ไทย:

- ลูกค้าสร้างร้านได้เองภายในนาที — `narakshop.pipecommerce.com`
- ใช้ custom domain ของตัวเองได้ — `narakshop.com` (Cloudflare for SaaS)
- รับเงินผ่าน Beamcheckout (PromptPay + บัตรเครดิต)
- มี CRM + loyalty + บทความ + custom theme builder + รายงาน

**ภาษา:**
- Code, identifiers, schema, file names: **English**
- Comments: **Thai เฉพาะส่วน "ทำไม"** — ห้าม comment "อะไร" ที่อ่าน code ก็รู้
- User-facing UI: **Thai**
- Communication กับ user: **Thai**

**ห้าม:**
- ใช้ emoji ใน UI (ใช้ lucide-react icons)
- Hard-code platform domain — ใช้ `process.env.PLATFORM_DOMAIN`
- UPDATE/DELETE `loyalty_ledger` (append-only)
- คำนวณราคา order ใหม่จาก current product price (snapshot ใน `orders.*_price`, `order_line_items.price`)
- Auto-merge customer identities — ถ้า login ด้วย provider ใหม่ที่ email ตรงกับเดิม ต้อง prompt

---

## 2. Tech Stack (Current state)

> Migrated off Cloudflare Workers + Supabase → Railway + Auth.js ใน 2026-05 (ดู ADR-020)

| Layer | Tool |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Runtime | Node 20+ (Railway) |
| Database | Railway Postgres + Drizzle ORM + postgres-js |
| Admin auth | **Auth.js v5 (NextAuth) + Drizzle adapter + Resend magic link**, session strategy = `database` |
| Customer auth | Custom JWT + HMAC magic link (per-shop, แยกจาก admin) |
| File storage | Cloudflare R2 (S3 API) via `@aws-sdk/client-s3` |
| Image serving | `files.pipecommerce.com` → `apps/r2-proxy` CF Worker → R2 |
| Custom domain | Cloudflare for SaaS Custom Hostnames API |
| Background jobs | pg-boss (Postgres-backed queue) ใน worker service แยก |
| Cron | pg-boss schedule (DB-persistent) ใน worker เดียวกับ queue |
| Email | Resend + React Email |
| Payment | Beamcheckout (Hosted Payment Links + signed webhook) |
| Error tracking | Sentry (Node SDK + Replay) |
| UI | shadcn/ui + Tailwind 4 + Radix + lucide-react icons |
| Validation | Zod |
| Forms | React Hook Form + Zod resolver |
| Package manager | pnpm 10 workspaces |
| Build orchestration | Turborepo |
| Hosting | **Railway** (4 services: admin + storefront + Postgres + worker) |

ที่ไม่ใช้:

| ❌ | เหตุผล |
| --- | --- |
| Vercel | Railway ราคา/scale ดีกว่า, ไม่ผูก Next.js version |
| Cloudflare Workers สำหรับ Next.js | postgres-js + Hyperdrive hang ใน runtime (ADR-020) |
| Supabase | ลด vendor dependency, Auth.js + Railway PG พอ |
| Prisma | Drizzle เบา + raw SQL friendly |
| tRPC | ใช้ Server Actions; public API จะเปิดทีหลัง |
| Schema-per-tenant | shared schema + app-layer authz เพียงพอ |

---

## 3. Repo Structure

```
pipecommerce/
├── apps/
│   ├── admin/                     Next.js — console.pipecommerce.com
│   │   ├── app/
│   │   │   ├── [shopSlug]/        per-shop admin UI
│   │   │   ├── api/auth/[...nextauth]/   Auth.js route handler
│   │   │   ├── api/cron/*/        HTTP cron endpoints (manual trigger fallback)
│   │   │   ├── _components/       admin-shared components
│   │   │   ├── login/, onboarding/, page.tsx
│   │   ├── lib/
│   │   │   ├── db.ts              Drizzle client (eager singleton)
│   │   │   ├── shop.ts            requireShop() — auth + membership check
│   │   │   ├── r2.ts              S3 client + publicImageUrl()
│   │   │   ├── cloudflare.ts      CF for SaaS API client
│   │   │   ├── queue.ts           pg-boss singleton + queue names
│   │   │   ├── cron-auth.ts       HMAC bearer auth for cron endpoints
│   │   │   ├── cron-tasks.ts      pure async functions for cron logic
│   │   ├── scripts/
│   │   │   ├── worker.ts          worker entrypoint (pg-boss + schedules + /health)
│   │   │   └── workers/           per-queue handlers (image-process, email-send)
│   │   ├── auth.ts                Auth.js config (Drizzle adapter + Resend)
│   │   ├── instrumentation.ts     Sentry server init
│   │   ├── instrumentation-client.ts  Sentry client init
│   │   ├── next.config.ts
│   │   ├── railway.json           Railway config (Next.js web service)
│   │   └── railway-worker.json    Railway config (worker service)
│   │
│   ├── storefront/                Next.js — pipecommerce.com + *.pipecommerce.com
│   │   ├── app/
│   │   │   ├── _components/       SiteHeader, AccountMenu, etc.
│   │   │   ├── _sections/         theme section renderer
│   │   │   ├── products/, cart/, checkout/, account/, blog/, ...
│   │   ├── lib/
│   │   │   ├── shop.ts            lookupShopByHost() — match custom domain or {slug}.{platform}
│   │   │   ├── customer-auth.ts   HMAC magic link + JWT session
│   │   │   ├── customer-session.ts getCustomer() / requireCustomer()
│   │   │   ├── beam.ts            payment client + HMAC webhook verifier
│   │   │   ├── html-sanitize.ts   regex-based sanitizer (no jsdom)
│   │
│   └── r2-proxy/                  CF Worker — files.pipecommerce.com → R2
│       (only CF Worker left in the project)
│
├── packages/
│   ├── db/                        Drizzle schema + migrations + client factory
│   │   ├── src/schema/            *.ts per table, exported from index.ts
│   │   ├── migrations/            sql per migration + meta/
│   │   └── drizzle.config.ts
│   ├── ui/                        shadcn primitives + ColorPicker + Table
│   └── config/                    shared eslint, tsconfig, tailwind preset
│
├── docs/                          design docs + ADRs
├── turbo.json
├── pnpm-workspace.yaml
└── package.json                   root scripts (db:generate, db:migrate, etc.)
```

---

## 4. Architecture (Production)

```
                          Cloudflare DNS / CDN
                          (TLS termination, CDN cache, Universal SSL)
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
              ▼                         ▼                         ▼
   console.pipecommerce.com    pipecommerce.com          files.pipecommerce.com
            │                  *.pipecommerce.com                  │
            │                   {custom}.com                       │
            │                   (CF for SaaS)                      │
            ▼                         ▼                            ▼
       Railway: admin           Railway: storefront         CF Worker: r2-proxy
       (Next.js 16)             (Next.js 16)                       │
            │                         │                            ▼
            │                         │                       Cloudflare R2
            │                         │                       (bucket: pipecommerce)
            └────────┬────────────────┘
                     │
                     ▼  (DATABASE_URL — Railway private network)
              Railway Postgres
                     ▲
                     │
              Railway: worker
              ├── pg-boss queue handlers (image-process, email-send, webhook-deliver)
              └── pg-boss schedules (4 cron jobs)
              │
              ▼ (HTTP health: GET /health)
          Railway healthcheck (auto-restart on failure)
```

**Services:** 4 ใน Railway project — `admin`, `storefront`, `Postgres`, `worker`

---

## 5. Local Development

### Setup ครั้งแรก

```bash
git clone https://github.com/tannysoft/pipecommerce.git
cd pipecommerce
pnpm install
```

สร้าง `.env.local` ที่ root (`drizzle.config.ts` โหลด `.env.local` override `.env`):

```
DATABASE_URL=postgresql://...   # Railway Postgres public URL หรือ local PG
```

Run migrations:

```bash
pnpm db:migrate
```

### Dev servers

```bash
pnpm dev                       # ทุก apps (Turbo)
# หรือ
pnpm --filter @pipecommerce/admin dev          # admin only — port 3001
pnpm --filter @pipecommerce/storefront dev     # storefront only — port 3000
```

### Drizzle Studio (DB browser)

```bash
pnpm db:studio
```

เปิดที่ `https://local.drizzle.studio`

### Commands cheat sheet

```bash
pnpm dev                       # dev all
pnpm build                     # build all
pnpm typecheck                 # typecheck all
pnpm lint                      # lint all
pnpm db:generate               # create migration from schema diff
pnpm db:migrate                # apply migrations to DB
pnpm db:push                   # skip migration, push schema (dev only)
pnpm db:studio                 # open Drizzle Studio
pnpm format                    # prettier write
```

---

## 6. Database

### Drizzle ORM patterns

- Schema ใน `packages/db/src/schema/*.ts` — แต่ละ table 1 file
- Re-export ทั้งหมดผ่าน `packages/db/src/schema/index.ts`
- ใช้ helpers ใน `_helpers.ts`: `id()`, `createdAt()`, `updatedAt()`, `deletedAt()`
- Casing: `casing: 'snake_case'` ใน drizzle.config — JS camelCase → SQL snake_case auto

### Query patterns

- `eq`, `and`, `or`, `sql` import จาก `@pipecommerce/db`
- Always scope queries by `shopId` (multi-tenant) — bug common ที่ลืม
- Use `cache()` จาก React สำหรับ dedupe ภายใน 1 request (เช่น `requireShop`, `lookupShopByHost`)

### RLS (Row Level Security)

- RLS เก่าที่ใช้ `auth.uid()` (Supabase) **ถูก stub ออก** ใน migrations 0013/0016/0018
- Authorization ย้ายไป **application layer** — เช็คใน Server Actions ผ่าน `requireShop(slug)` หรือ `requireShopFromHost()`
- ทุก mutation ที่อิง shop **ต้อง verify membership ก่อน** — pattern ตัวอย่าง:
  ```ts
  export async function someAction(shopSlug: string, ...) {
    const { shop } = await requireShop(shopSlug)  // throws if not member
    // safe to use shop.id
  }
  ```

### Append-only ledger

`loyalty_ledger` ห้าม UPDATE/DELETE (บังคับด้วย Postgres RULES ใน migration 0009):
- `earn` / `redeem` / `expire` / `adjust` / `refund_reverse` rows
- `customer_loyalty.points_balance` เป็น cache, recompute ได้จาก SUM(ledger)
- Cron `cron-loyalty-reconcile` ทำงานทุกคืน fix drift

### Migration workflow

```bash
# 1. แก้ schema ใน packages/db/src/schema/*.ts
# 2. generate migration
pnpm db:generate
# 3. review SQL ใน packages/db/migrations/NNNN_*.sql
# 4. apply
pnpm db:migrate
```

ห้าม edit migration files ที่ apply ไปแล้ว — สร้าง migration ใหม่แทน

---

## 7. Auth

### Admin auth (Auth.js v5)

- Config: `apps/admin/auth.ts`
- Tables: `users`, `accounts`, `sessions`, `verification_tokens` (Auth.js standard)
- Session strategy: `database` (opaque cookie token, no JWT)
- Provider: Resend magic link
- Route handler: `apps/admin/app/api/auth/[...nextauth]/route.ts`

ใช้ใน server component / action:

```ts
import { auth } from '@/auth.ts'
const session = await auth()
if (!session?.user?.id) redirect('/login')
```

หรือ `requireShop(slug)` ใน `lib/shop.ts` ที่ wrap auth + membership check

### Customer auth (custom)

- คนละระบบกับ admin — scoped per-shop
- HMAC magic link → store HMAC-signed JWT ใน cookie
- Config: `apps/storefront/lib/customer-auth.ts`, `customer-session.ts`
- ใช้: `await getCustomer()` (nullable) หรือ `await requireCustomer()` (redirect)

⚠️ Customer + Admin tables แยกกันเด็ดขาด — `users` (Auth.js admin) ≠ `customers` (storefront)

### Env vars

```
AUTH_SECRET            openssl rand -base64 32
AUTH_URL               https://console.pipecommerce.com (production)
AUTH_TRUST_HOST        true
RESEND_API_KEY         re_...
RESEND_FROM_ADDRESS    noreply@pipecommerce.com (Resend-verified domain)
```

---

## 8. File Storage (R2)

### Layout

```
shops/{shop_id}/orig/{uuid}.{ext}          original uploads (product images, article featured)
shops/{shop_id}/img/{uuid}/{variant}.webp  resized variants (low/mid/high — by worker)
shops/{shop_id}/logo-{suffix}.{ext}        shop logo (random suffix for cache-bust)
```

### Upload pattern (Server Action)

```ts
const r2Key = `shops/${shop.id}/orig/${crypto.randomUUID()}.${ext}`
await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: r2Key, Body: buffer, ContentType: file.type }))
// store r2Key in DB
// publicImageUrl(r2Key) → https://files.pipecommerce.com/{r2Key}
```

### Public URL

ทุก URL ใช้ `publicImageUrl(r2Key)` จาก `lib/r2.ts` (admin) หรือ `lib/image.ts` (storefront) — ไม่ hard-code base

---

## 9. Background Jobs (pg-boss)

### Queues

| Queue | Producer | Worker |
| --- | --- | --- |
| `image-process` | `uploadProductImage` action | `scripts/workers/image-process.ts` — sharp → 3 WebP variants |
| `email-send` | (TBD wire-up) | `scripts/workers/email-send.ts` — Resend send |
| `webhook-deliver` | (TBD wire-up) | (TBD) |
| `cron-*` (4 queues) | pg-boss schedule | inline ใน `scripts/worker.ts` |

### Producer pattern

```ts
import { getQueue, QUEUES } from '@/lib/queue.ts'
const boss = await getQueue()
await boss.send(QUEUES.imageProcess, { imageId, r2Key, shopId })
```

Fail-safe: ถ้า queue offline (เช่น worker ไม่ run) — wrap ใน try-catch + fallback:

```ts
try {
  const boss = await getQueue()
  await boss.send(QUEUES.imageProcess, { ... })
} catch (err) {
  console.error('enqueue failed:', err)
  // fallback path เช่น mark status='ready' ใช้ original ตรงๆ
}
```

### Important: pg-boss v10 quirk

ต้อง `boss.createQueue(name)` ก่อน `boss.work()` หรือ `boss.schedule()` ครั้งแรก — schedule.name มี FK ไป queue table. ใน worker boot ที่ `scripts/worker.ts` loop createQueue ทั้งหมดก่อนเสมอ (idempotent)

---

## 10. Cron

ทุก cron schedule อยู่ใน worker service เดียวกัน, **pg-boss schedule** (DB-persistent):

| Schedule (UTC) | Queue | ICT |
| --- | --- | --- |
| `0 19 * * *` | `cron-report-snapshot` | 02:00 |
| `0 20 * * *` | `cron-loyalty-expire` | 03:00 |
| `0 21 * * *` | `cron-loyalty-reconcile` | 04:00 |
| `*/5 * * * *` | `cron-sync-hostnames` | every 5 min |

Logic ใน `lib/cron-tasks.ts` — pure async functions, return stats object. HTTP wrappers ใน `/api/cron/*/route.ts` เผื่อ manual trigger หรือ external cron service

### HTTP trigger (debug)

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://console.pipecommerce.com/api/cron/loyalty-expire
```

`CRON_SECRET` = random base64 ที่เราสร้างเอง (ไม่มีจาก vendor ที่ไหน). ตั้งเหมือนกันใน admin + worker services

### Reliability — 5 ชั้น

1. Per-task try-catch (worker process ไม่ตาย)
2. pg-boss retry (3 ครั้ง default + exponential backoff)
3. DB-persistent schedules (รอด worker restart)
4. HTTP `/health` probe (Railway restart on hang)
5. Railway `restart_policy: ON_FAILURE`

ทุก cron task **idempotent** — running twice ไม่เสีย (NOT EXISTS / ON CONFLICT / SET = SUM)

---

## 11. Cloudflare for SaaS (Custom Domains)

ลูกค้าใช้ `narakshop.com` ของตัวเอง:

1. Admin → `/{shop}/settings/domains` → ใส่ hostname
2. `addCustomDomain()` → call CF API → store `cf_hostname_id`
3. UI แสดง CNAME target + DCV records ให้ลูกค้าเอาไป config DNS provider
4. Cron `cron-sync-hostnames` ทุก 5 นาที poll CF → update `ssl_status`
5. ลูกค้า config DNS แล้ว → CF ออก cert auto → `ssl_status = active`
6. Storefront `lookupShopByHost(host)` match `shop_domains.hostname` → resolve shop

ENV ที่ต้องตั้ง (admin + worker):

```
CF_ACCOUNT_ID
CF_ZONE_ID                   pipecommerce.com zone
CF_API_TOKEN                 Zone: SSL and Certificates: Edit permission
CF_FALLBACK_ORIGIN           storefront-production-xxx.up.railway.app
```

ถ้า env ไม่ครบ → `isCloudflareConfigured()` คืน false → feature disable (UI ขึ้น error)

---

## 12. Deployment (Railway)

ดู `docs/RAILWAY.md` สำหรับ full guide

### Services (4 ตัว)

| Service | Config path | Public domain |
| --- | --- | --- |
| `Postgres` | (Railway plugin) | — |
| `admin` | `apps/admin/railway.json` | `console.pipecommerce.com` |
| `storefront` | `apps/storefront/railway.json` | `pipecommerce.com`, `*.pipecommerce.com` |
| `worker` | `apps/admin/railway-worker.json` | (ไม่ต้องมี — internal health check) |

### Build/Start commands (เผื่อ config-as-code ใช้ไม่ได้)

```
admin / storefront:
  build:  corepack enable && pnpm install --frozen-lockfile && pnpm --filter @pipecommerce/{admin|storefront}... build
  start:  pnpm --filter @pipecommerce/{admin|storefront} start

worker:
  build:  เหมือน admin
  start:  pnpm --filter @pipecommerce/admin worker
  healthcheck: /health
```

### Environment variables — full reference

Shared (ตั้งใน admin + storefront + worker):

```
DATABASE_URL=${{ Postgres.DATABASE_URL }}
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=pipecommerce
R2_PUBLIC_URL=https://files.pipecommerce.com
RESEND_API_KEY=re_...
RESEND_FROM_ADDRESS=noreply@pipecommerce.com
PLATFORM_DOMAIN=pipecommerce.com
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...   (optional)
```

Admin only:

```
AUTH_SECRET=base64-32-bytes
AUTH_URL=https://console.pipecommerce.com
AUTH_TRUST_HOST=true
BEAM_API_KEY=                                (blank = stub mode)
BEAM_WEBHOOK_SECRET=                         (required in production)
```

Admin + worker (cron + CF):

```
CRON_SECRET=base64-32-bytes
CF_ACCOUNT_ID=
CF_ZONE_ID=
CF_API_TOKEN=
CF_FALLBACK_ORIGIN=storefront-production-xxx.up.railway.app
```

### DNS (Cloudflare)

```
console.pipecommerce.com     CNAME → admin Railway target       DNS only / grey
pipecommerce.com (@)         CNAME → storefront Railway target  proxied / orange (CF terminates TLS)
*.pipecommerce.com           CNAME → storefront Railway target  DNS only / grey
                             (+ _acme-challenge CNAME → railway authorize record)
files.pipecommerce.com       Workers Route → r2-proxy           proxied / orange
```

Wildcard ใช้ DNS-only เพื่อ Railway issue wildcard cert ผ่าน ACME DNS-01

---

## 13. Conventions

### File naming

- React components: `kebab-case.tsx` (`product-gallery.tsx`)
- Server actions: `actions.ts` ใน folder เดียวกับ page
- Utilities: `kebab-case.ts` ใน `lib/`
- Imports: relative within app (`./`), workspace alias `@/lib/*` for app root, `@pipecommerce/db` for packages

### Form actions pattern

```ts
// actions.ts
'use server'
export async function someAction(shopSlug: string, formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const { shop } = await requireShop(shopSlug)  // auth + tenancy
  // validate
  // mutate
  revalidatePath(...)
  return { ok: true }
}

// form.tsx
'use client'
import { useTransition } from 'react'
const [pending, start] = useTransition()
start(async () => {
  const res = await someAction(shopSlug, formData)
  if (!res.ok) setError(res.error)
})
```

### Error handling pattern

- Server actions คืน `{ ok: true, ... } | { ok: false; error: string }` — ไม่ throw (ยกเว้น redirect/notFound)
- Cron tasks return stats object — wrap ใน try-catch ที่ caller
- Throwing in worker queue handler → pg-boss retry

### Date handling

- ใน DB: `timestamp({ withTimezone: true })` เสมอ
- ใน JS: `new Date()` ส่งตรงได้
- Per-shop timezone: ใช้ `shop.timezone` (default `Asia/Bangkok`) สำหรับ business-day boundary (report snapshot, abandoned cart, ฯลฯ) — compute ใน SQL ด้วย `AT TIME ZONE`

### Tailwind v4 quirks

- `<button>` default cursor = default → เพิ่ม `cursor-pointer` (มี global rule ใน `packages/ui/src/styles/globals.css` แล้ว — ใช้กับ ทุก app)
- `@source` directive จำเป็นถ้า scan classes จาก workspace packages — มีใน `app/globals.css` ของแต่ละ app
- Custom variants ใน `packages/ui/src/styles/globals.css`

### Icons

- ใช้ **lucide-react** เท่านั้น — no emoji ใน UI
- Size: `className="size-4"` (default) หรือ `size-3.5`, `size-5`
- Hidden จาก screen readers: `aria-hidden`

### Colors

- ใน admin form: ใช้ `<ColorPicker>` จาก `@pipecommerce/ui` ทุกที่ — มี preset palette + custom input + clear
- ไม่ใช้ `<input type="color">` ตรงๆ — ขาด preset + UX แย่
- Pass-through `oklch()`, `rgb()`, named colors ได้ (ไม่ใช่แค่ hex)

---

## 14. Common Pitfalls (จากที่เจอมาแล้ว)

### Railway / Reverse proxy

- `request.url` ใน route handler = internal `http://localhost:8080/...` (port container) — สำหรับ redirect ใช้ `x-forwarded-host` + `x-forwarded-proto` แทน
- `headers().get('host')` ก็เหมือนกัน — อ่าน `x-forwarded-host` ก่อน (มี `trustHost: true` ใน Auth.js)
- ตั้ง `AUTH_URL` env var ให้ตรงกับ public URL ที่ user เข้า

### Next.js 16

- `middleware.ts` ถูกแทนด้วย `proxy.ts` — แต่ OpenNext / Cloudflare Workers รองรับไม่ครบ → ย้าย auth check เข้า individual pages แทน
- `instrumentation.ts` คือทางที่ Next.js init Sentry (server) + `instrumentation-client.ts` (browser)
- `next.config.ts` compile เป็น CJS → import.meta.url ใช้ไม่ได้ ใช้ `process.cwd()`

### Drizzle + Auth.js

- `db` ที่ใช้กับ `DrizzleAdapter(db, {...})` ต้องเป็น **real instance** ไม่ใช่ Proxy — `is(db, PgDatabase)` brand check จะ fail ถ้า prototype ผิด → ใช้ eager singleton ใน `lib/db.ts`
- postgres-js connection lazy — eager init ของ db client ไม่เปิด socket จนกว่าจะ query → ปลอดภัยที่ module load

### pg-boss v10

- ต้อง `createQueue(name)` ก่อน `work()` / `schedule()` — schedules table FK → queues table
- Schedules persist ใน DB → restart worker ไม่หาย

### Image handling

- ไม่ใช้ Next Image optimization (`images: { unoptimized: true }`) — เสิร์ฟตรงจาก R2 + CF cache
- `<img>` ตรงๆ + `referrerPolicy="no-referrer"` ตอน fetch รูปจาก social CDN (Google/LINE)

### Resend / Email

- `RESEND_FROM_ADDRESS` ต้องเป็น email ที่ domain verified ใน Resend dashboard — ถ้าไม่ verified จะ reject silently
- Sandbox: ใช้ `onboarding@resend.dev` ส่งได้แค่หา email ของเจ้าของ Resend account
- Auth.js v5 `signIn('resend', ...)` ห้าม `redirect: false` ใน server action (มี bug — ไม่ส่งจริง) — ปล่อย default redirect ใน Auth.js v5 pattern

### CF for SaaS

- Wildcard cert ผ่าน Railway ACME DNS-01 ต้อง add `_acme-challenge` CNAME → `*.authorize.railwaydns.net`
- Wildcard record ใน CF DNS ต้อง grey (DNS only) ตอน Railway verify; flip orange ทีหลังได้ (CF proxy + Universal SSL)
- CF SSL/TLS mode = **Full** (ไม่ใช่ Flexible หรือ Full strict) เพราะ origin cert เป็น `*.up.railway.app` ไม่ match `*.pipecommerce.com`

### Tailwind v4

- `<button>` cursor default → ใส่ `cursor-pointer` หรือพึ่ง global rule ใน ui package
- ต้อง `@source` directive ใน app globals.css ถ้าจะใช้ classes จาก packages/ui

---

## 15. Adding new features — checklist

เวลาเพิ่ม feature ใหม่:

- [ ] Schema → `packages/db/src/schema/*.ts` + `pnpm db:generate` + review SQL
- [ ] Apply migration → `pnpm db:migrate`
- [ ] Admin UI ที่ `apps/admin/app/[shopSlug]/...`
  - [ ] page.tsx (server component) — `requireShop()` ทุกครั้ง
  - [ ] form.tsx (client component) — React Hook Form + Zod
  - [ ] actions.ts (`'use server'`) — `requireShop()` แล้ว validate ทุก field
  - [ ] `revalidatePath()` หลัง mutation
- [ ] Storefront UI ที่ `apps/storefront/app/...`
  - [ ] `requireShopFromHost()` หรือ `lookupShopByHost()` resolve shop
  - [ ] ห้าม leak ของ shop อื่น
- [ ] ถ้ามี image upload — ใส่ใน R2 ที่ `shops/{shopId}/orig/...` + enqueue `image-process`
- [ ] ถ้ามี long-running task — ใส่เข้า queue (`getQueue().send(...)`)
- [ ] ถ้ามี scheduled — เพิ่ม cron-task fn + queue + schedule ใน worker.ts
- [ ] `pnpm typecheck` ผ่าน
- [ ] Commit + push → Railway auto-deploy

---

## 16. Resources

- **Drizzle ORM:** https://orm.drizzle.team/
- **Auth.js v5:** https://authjs.dev/
- **pg-boss:** https://github.com/timgit/pg-boss
- **Cloudflare for SaaS Custom Hostnames:** https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
- **Railway docs:** https://docs.railway.com/
- **Resend API:** https://resend.com/docs
- **Beamcheckout:** https://docs.beamcheckout.com/

---

## 17. ADRs ที่สำคัญ

ดู `docs/DECISIONS.md` สำหรับทั้งหมด:

- **ADR-020** (2026-05): Migrate off Cloudflare Workers → Railway (root cause: postgres-js hang)
- **ADR-018**: Tax 3 modes (inclusive_customer / exclusive_customer / shop_absorbs)
- **ADR-016**: Loyalty append-only ledger
- **ADR-007**: Image variants pipeline (low/mid/high WebP)
- **ADR-003**: Beamcheckout marketplace limitations
