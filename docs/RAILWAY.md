# Railway deploy guide

PipeCommerce **moved off Cloudflare Workers** because `postgres-js` + Hyperdrive hung
in the Workers runtime. Apps now run as long-lived Node servers on **Railway**,
while Cloudflare keeps providing DNS + R2 + CDN + the `r2-proxy` worker for
`files.pipecommerce.com`.

## Architecture

```
                          ┌──────────────────────┐
   user (browser)  ───→   │ Cloudflare DNS / CDN │  ───→  Railway services
                          └──────────────────────┘
                                                    ├─ admin     (console.pipecommerce.com)
                                                    ├─ storefront (pipecommerce.com + *.pipecommerce.com)
                                                    └─ postgres   (private network only)

   image uploads ────→  Cloudflare R2 (bucket: pipecommerce)
   image reads   ────→  files.pipecommerce.com  →  r2-proxy worker  →  R2
```

## Services to create on Railway

1. **Postgres** — provisioned plugin. Copy `DATABASE_URL` (private + public both).
2. **admin** — service pointing at this repo, root `/`, watching `apps/admin/**`.
3. **storefront** — service pointing at this repo, root `/`, watching `apps/storefront/**`.

Both services pick up build/start commands from `apps/<name>/railway.json` automatically
when Railway is configured to read service config from that path. If not, paste the
commands manually:

- **Build:** `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @pipecommerce/admin... build`
- **Start:** `pnpm --filter @pipecommerce/admin start`

(swap `admin` → `storefront` for the other service)

## Environment variables

### Shared (both apps)

| Var | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — Railway reference |
| `R2_ACCOUNT_ID` | from Cloudflare R2 dashboard |
| `R2_ACCESS_KEY_ID` | R2 API token |
| `R2_SECRET_ACCESS_KEY` | R2 API token |
| `R2_BUCKET` | `pipecommerce` |
| `R2_PUBLIC_URL` | `https://files.pipecommerce.com` |
| `RESEND_API_KEY` | from Resend dashboard |
| `RESEND_FROM_ADDRESS` | `noreply@pipecommerce.com` (verified domain) |
| `PLATFORM_DOMAIN` | `pipecommerce.com` |
| `NODE_ENV` | `production` (Railway sets automatically) |

### Admin only (Auth.js)

| Var | Value |
| --- | --- |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://console.pipecommerce.com` |
| `AUTH_TRUST_HOST` | `true` |

## DNS (Cloudflare)

After Railway gives each service a public domain (e.g. `admin-production.up.railway.app`),
swap the existing Workers DNS:

| Hostname | Type | Target | Proxy |
| --- | --- | --- | --- |
| `console.pipecommerce.com` | CNAME | `admin-production.up.railway.app` | DNS only (grey) |
| `pipecommerce.com` | CNAME (flattened) | `storefront-production.up.railway.app` | DNS only |
| `*.pipecommerce.com` | CNAME | `storefront-production.up.railway.app` | DNS only |
| `files.pipecommerce.com` | Workers Route | r2-proxy worker (unchanged) | proxied |

Then on Railway side, add each custom domain to the matching service — Railway
provisions a Let's Encrypt cert automatically once DNS resolves.

> Proxied (orange) mode through Cloudflare also works but TLS termination then
> happens at Cloudflare's edge — Railway has to be reachable on HTTP from CF.
> For simplicity start with DNS-only.

## Data migration (Supabase → Railway PG)

One-shot pg_dump / pg_restore — run locally:

```bash
# 1. Dump Supabase
pg_dump \
  --host db.<project-ref>.supabase.co \
  --port 5432 \
  --username postgres \
  --no-owner --no-privileges \
  --schema=public \
  --file=supabase-dump.sql \
  postgres

# 2. Apply Drizzle migrations on Railway first (creates schema)
DATABASE_URL=<railway-public-url> pnpm db:migrate

# 3. Restore data only (skip schema lines — Drizzle owns schema)
psql <railway-public-url> < supabase-dump.sql
```

Or simpler if you don't have meaningful data yet: just run `pnpm db:migrate` on
Railway and start fresh.

## Auth.js note

`session.strategy = 'database'` — sessions live in Postgres (`sessions` table)
and the session cookie is just an opaque token. No JWT, no cross-domain headache.

First admin login: visit `/login`, type your email, click the Resend magic link.
Auth.js creates the row in `users` automatically. After login, `/onboarding`
creates the first shop and links you in `shop_members`.

## What we removed

- `apps/{admin,storefront}/wrangler.toml` — no more Workers
- `apps/{admin,storefront}/open-next.config.ts` — no OpenNext build step
- `@opennextjs/cloudflare`, `wrangler`, `@cloudflare/workers-types` deps
- `@pipecommerce/auth` package — replaced by Auth.js v5 in `apps/admin/auth.ts`
- `@supabase/ssr`, `@supabase/supabase-js` deps

## What we kept on Cloudflare

- DNS (pipecommerce.com zone)
- R2 (image storage)
- `apps/r2-proxy` worker (serves `files.pipecommerce.com`)
- Cloudflare for SaaS Custom Hostnames (custom domain feature for tenants —
  hostnames now CNAME to Railway storefront instead of CF worker route)
