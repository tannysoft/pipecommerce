# Database Schema

> PostgreSQL บน Supabase + Drizzle ORM + RLS
> Last updated: 2026-05-05

## Conventions

- ทุกตารางที่เกี่ยวกับร้านมี `shop_id uuid` คอลัมน์ (ไม่ NULL)
- Primary key เป็น `uuid` (ใช้ `gen_random_uuid()`)
- Timestamps: `created_at`, `updated_at` (timestamptz, default `now()`)
- Soft delete: `deleted_at timestamptz NULL` ในตารางที่ต้องการ
- RLS เปิดทุกตาราง — pattern policy ดูท้ายเอกสาร
- Money: `numeric(12,2)` — ห้ามใช้ `float`/`real`

---

## 1. Tenant & Identity

### `shops`
```sql
shops (
  id              uuid PK,
  slug            text UNIQUE NOT NULL,    -- yourapp.com/{slug} หรือ {slug}.yourapp.com
  name            text NOT NULL,
  owner_user_id   uuid → auth.users,
  plan_id         uuid → plans,
  currency        text DEFAULT 'THB',
  timezone        text DEFAULT 'Asia/Bangkok',
  status          text NOT NULL,           -- active | suspended | trial
  trial_ends_at   timestamptz,
  settings        jsonb DEFAULT '{}',      -- flexible misc settings
  created_at, updated_at, deleted_at
)
```

### `shop_domains`
```sql
shop_domains (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  hostname        text UNIQUE NOT NULL,
  is_primary      boolean DEFAULT false,
  ssl_status      text NOT NULL,           -- pending | active | failed | revoked
  cf_hostname_id  text,                    -- จาก Cloudflare Custom Hostnames API
  verified_at     timestamptz,
  last_checked_at timestamptz,
  created_at
)
CREATE INDEX ON shop_domains(hostname);
CREATE UNIQUE INDEX ON shop_domains(shop_id) WHERE is_primary = true;
```

### `shop_members`
```sql
shop_members (
  shop_id         uuid → shops,
  user_id         uuid → auth.users,
  role            text NOT NULL,           -- owner | admin | staff | viewer
  permissions     jsonb DEFAULT '{}',
  invited_at      timestamptz,
  accepted_at     timestamptz,
  PRIMARY KEY (shop_id, user_id)
)
```

### `customers` (end customers ของแต่ละร้าน)
```sql
customers (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  email           text,                    -- nullable: บางคน login ผ่าน social ที่ไม่แชร์ email
  phone           text,
  first_name, last_name text,
  accepts_marketing boolean DEFAULT false,
  total_spent     numeric(12,2) DEFAULT 0,
  orders_count    int DEFAULT 0,
  tags            text[] DEFAULT '{}',
  created_at, updated_at,
  UNIQUE (shop_id, email) WHERE email IS NOT NULL    -- email unique per shop เมื่อมี
)
CREATE INDEX ON customers(shop_id, phone);
```

### `customer_identities`
ลูกค้า 1 คน → N identity (login ผ่าน Google + Facebook + LINE ก็ได้, link เข้าด้วยกัน)

```sql
customer_identities (
  id              uuid PK,
  customer_id     uuid → customers NOT NULL,
  shop_id         uuid → shops NOT NULL,
  provider        text NOT NULL,           -- email | google | facebook | line
  provider_user_id text,                    -- sub | app-scoped id | line userId; NULL สำหรับ email magic link
  email_at_provider text,                   -- email ที่ provider ส่งมา (อาจไม่ตรงกับ customers.email)
  display_name    text,
  picture_url     text,
  raw_profile     jsonb,                    -- เก็บ profile ดิบไว้ debug + อัปเดต
  is_primary      boolean DEFAULT false,    -- provider หลักที่ใช้ login ครั้งแรก
  email_verified  boolean DEFAULT false,
  last_login_at   timestamptz,
  created_at, updated_at,
  UNIQUE (shop_id, provider, provider_user_id)
)
CREATE INDEX ON customer_identities(customer_id);
```

### `shop_auth_settings`
เจ้าของร้านเลือก provider ที่จะเปิดใน storefront

```sql
shop_auth_settings (
  shop_id         uuid PK → shops,
  email_enabled   boolean DEFAULT true,    -- magic link
  google_enabled  boolean DEFAULT false,
  facebook_enabled boolean DEFAULT false,
  line_enabled    boolean DEFAULT false,   -- [P2]
  guest_checkout_enabled boolean DEFAULT true,
  require_email_verification boolean DEFAULT false,
  custom_redirect_after_login text,
  updated_at, updated_by uuid → auth.users
)
```

### `customer_sessions` (revocation list)
```sql
customer_sessions (
  id              uuid PK,                  -- = jti ใน JWT
  customer_id     uuid → customers NOT NULL,
  shop_id         uuid → shops NOT NULL,
  user_agent      text,
  ip              inet,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  last_seen_at    timestamptz
)
CREATE INDEX ON customer_sessions(customer_id, revoked_at);
```

### `customer_addresses`
```sql
customer_addresses (
  id              uuid PK,
  customer_id     uuid → customers,
  shop_id         uuid → shops,            -- denormalized for RLS
  is_default      boolean DEFAULT false,
  first_name, last_name, company text,
  address1, address2, city, province, postal_code text,
  country         text DEFAULT 'TH',
  phone           text,
  created_at
)
```

---

## 2. Catalog

### `products`
```sql
products (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  title           text NOT NULL,
  handle          text NOT NULL,           -- URL slug
  description     text,                    -- HTML
  status          text NOT NULL,           -- draft | active | archived
  product_type    text,
  vendor          text,
  tags            text[] DEFAULT '{}',
  seo_title, seo_description text,

  -- search (full-text + trigram for Thai fuzzy match)
  search_vector   tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(unaccent(title), '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(unaccent(left(strip_html(description), 4000)), '')), 'C')
  ) STORED,

  published_at    timestamptz,
  created_at, updated_at, deleted_at,
  UNIQUE (shop_id, handle)
)
CREATE INDEX ON products(shop_id, status, published_at);
CREATE INDEX products_search_idx ON products USING GIN(search_vector);
CREATE INDEX products_title_trgm_idx ON products USING GIN(title gin_trgm_ops);
CREATE INDEX products_handle_trgm_idx ON products USING GIN(handle gin_trgm_ops);

-- ต้องเปิด extension:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE INDEX ON products USING GIN(tags);
```

### `product_options`
```sql
product_options (
  id              uuid PK,
  product_id      uuid → products NOT NULL,
  name            text NOT NULL,           -- "Size", "Color"
  position        int NOT NULL,
  values          text[] NOT NULL          -- ['S','M','L']
)
```

### `product_variants`
```sql
product_variants (
  id              uuid PK,
  product_id      uuid → products NOT NULL,
  shop_id         uuid → shops NOT NULL,   -- denormalized for RLS
  sku             text,
  barcode         text,
  title           text NOT NULL,           -- "Red / M"
  option1, option2, option3 text,
  price           numeric(12,2) NOT NULL,
  compare_at_price numeric(12,2),
  cost_per_item   numeric(12,2),           -- private
  weight_grams    int,
  requires_shipping boolean DEFAULT true,
  taxable         boolean DEFAULT true,
  position        int NOT NULL DEFAULT 0,
  created_at, updated_at,
  UNIQUE (shop_id, sku) WHERE sku IS NOT NULL
)
CREATE INDEX ON product_variants(product_id);
```

### `product_images`
```sql
product_images (
  id              uuid PK,
  product_id      uuid → products NOT NULL,
  variant_id      uuid → product_variants NULL,
  shop_id         uuid → shops NOT NULL,
  uuid            uuid NOT NULL UNIQUE,     -- ใช้ใน R2 path
  ext             text NOT NULL,            -- jpg | png | webp ของต้นฉบับ
  r2_key_orig     text NOT NULL,            -- shops/{shop_id}/orig/{uuid}.{ext}
  alt             text,
  position        int NOT NULL DEFAULT 0,
  width, height   int,
  bytes           int,
  variants_status text NOT NULL DEFAULT 'pending', -- pending | processing | ready | failed
  variants_error  text,                     -- error message ถ้า failed
  created_at, updated_at, deleted_at
)
```

**Variants:** ไม่เก็บใน DB — derive จาก `uuid` ตาม convention path
```
shops/{shop_id}/img/{uuid}/low.webp
shops/{shop_id}/img/{uuid}/mid.webp
shops/{shop_id}/img/{uuid}/high.webp
```

URL helper ดู `packages/ui/src/Image.tsx` ใน [ARCHITECTURE.md](ARCHITECTURE.md#image-pipeline)

### `collections` & `collection_products`
```sql
collections (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  title           text NOT NULL,
  handle          text NOT NULL,
  description     text,
  type            text NOT NULL,           -- manual | smart
  rules           jsonb,                   -- สำหรับ smart
  image_id        uuid → product_images,
  seo_title, seo_description text,
  created_at, updated_at,
  UNIQUE (shop_id, handle)
)

collection_products (
  collection_id   uuid → collections,
  product_id      uuid → products,
  position        int NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
)
```

---

## 3. Inventory

### `locations`
```sql
locations (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  name            text NOT NULL,
  address         jsonb,
  is_default      boolean DEFAULT false,
  is_active       boolean DEFAULT true,
  created_at
)
```

### `inventory_items`
```sql
inventory_items (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  variant_id      uuid → product_variants NOT NULL,
  location_id     uuid → locations NOT NULL,
  available       int NOT NULL DEFAULT 0,  -- พร้อมขาย
  committed       int NOT NULL DEFAULT 0,  -- จองแล้ว (pending order)
  on_hand         int GENERATED ALWAYS AS (available + committed) STORED,
  UNIQUE (variant_id, location_id)
)
```

### `inventory_movements`
```sql
inventory_movements (
  id              uuid PK,
  inventory_item_id uuid → inventory_items NOT NULL,
  shop_id         uuid → shops NOT NULL,
  delta           int NOT NULL,            -- + หรือ -
  reason          text NOT NULL,           -- order | return | manual | restock | adjustment
  reference_id    uuid,                    -- order_id หรืออื่น
  note            text,
  created_at, created_by uuid → auth.users
)
CREATE INDEX ON inventory_movements(inventory_item_id, created_at);
```

**Race condition handling (checkout):**
```sql
BEGIN;
SELECT available FROM inventory_items
  WHERE variant_id = $1 AND location_id = $2
  FOR UPDATE;
-- เช็ค → UPDATE → INSERT inventory_movements
COMMIT;
```

---

## 4. Cart & Checkout

### `carts`
```sql
carts (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  customer_id     uuid → customers NULL,   -- guest cart ก็ได้
  token           text UNIQUE NOT NULL,    -- ส่งให้ client เก็บ cookie
  currency        text NOT NULL,
  note            text,
  abandoned_email_sent_at timestamptz,
  expires_at      timestamptz,             -- cleanup
  created_at, updated_at
)
CREATE INDEX ON carts(shop_id, customer_id);
CREATE INDEX ON carts(expires_at) WHERE customer_id IS NOT NULL;
```

### `cart_items`
```sql
cart_items (
  id              uuid PK,
  cart_id         uuid → carts NOT NULL,
  variant_id      uuid → product_variants NOT NULL,
  quantity        int NOT NULL CHECK (quantity > 0),
  -- ⚠ ไม่ snapshot ราคา — คำนวณตอน checkout
  created_at
)
```

### `cart_discount_codes`
```sql
cart_discount_codes (
  cart_id         uuid → carts,
  discount_id     uuid → discounts,
  PRIMARY KEY (cart_id, discount_id)
)
```

---

## 5. Orders

### `orders`
```sql
orders (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  order_number    text NOT NULL,           -- "1001" ต่อร้าน
  tracking_token  text NOT NULL UNIQUE,    -- random 32-char opaque, สำหรับ public tracking page
  customer_id     uuid → customers NULL,
  email           text,                    -- guest checkout
  phone           text,

  -- snapshot prices ณ เวลา order
  currency        text NOT NULL,
  subtotal_price  numeric(12,2) NOT NULL,
  total_discounts numeric(12,2) NOT NULL DEFAULT 0,
  total_shipping  numeric(12,2) NOT NULL DEFAULT 0,
  total_tax       numeric(12,2) NOT NULL DEFAULT 0,
  total_price     numeric(12,2) NOT NULL,

  -- state machines
  financial_status text NOT NULL,          -- pending | paid | partially_refunded | refunded | voided
  fulfillment_status text NOT NULL,        -- unfulfilled | partial | fulfilled
  status          text NOT NULL,           -- open | closed | cancelled

  -- snapshot addresses
  shipping_address jsonb,
  billing_address  jsonb,

  -- loyalty (section 8) — snapshot at order time
  loyalty_points_earned    int NOT NULL DEFAULT 0,
  loyalty_points_redeemed  int NOT NULL DEFAULT 0,
  loyalty_amount_redeemed  numeric(12,2) NOT NULL DEFAULT 0,

  cancel_reason   text,
  cancelled_at, closed_at timestamptz,
  created_at, updated_at,
  UNIQUE (shop_id, order_number)
)
CREATE INDEX ON orders(shop_id, created_at DESC);
CREATE INDEX ON orders(shop_id, financial_status);
CREATE INDEX ON orders(customer_id);
```

### `order_line_items`
```sql
order_line_items (
  id              uuid PK,
  order_id        uuid → orders NOT NULL,
  shop_id         uuid → shops NOT NULL,
  variant_id      uuid → product_variants NULL,  -- nullable เผื่อ variant ถูกลบ

  -- snapshot ทั้งหมด
  product_title   text NOT NULL,
  variant_title   text,
  sku             text,
  quantity        int NOT NULL,
  price           numeric(12,2) NOT NULL,
  total_discount  numeric(12,2) NOT NULL DEFAULT 0,
  tax_lines       jsonb DEFAULT '[]',
  requires_shipping boolean,
  fulfillment_status text                   -- per-line tracking
)
```

### `order_discount_applications`
```sql
order_discount_applications (
  id              uuid PK,
  order_id        uuid → orders NOT NULL,
  discount_id     uuid → discounts NULL,   -- nullable เผื่อ discount ถูกลบ
  code            text,                     -- snapshot
  type            text NOT NULL,            -- percentage | fixed_amount | free_shipping | bxgy
  value           numeric(12,2) NOT NULL,
  amount_applied  numeric(12,2) NOT NULL    -- จริงๆ ลดไปเท่าไร
)
```

### `fulfillments`
```sql
fulfillments (
  id              uuid PK,
  order_id        uuid → orders NOT NULL,
  shop_id         uuid → shops NOT NULL,
  status          text NOT NULL,           -- pending | shipped | delivered | failed | cancelled
  tracking_company text,
  tracking_number text,
  tracking_url    text,
  shipped_at, delivered_at timestamptz,
  created_at, updated_at
)

fulfillment_line_items (
  fulfillment_id  uuid → fulfillments,
  line_item_id    uuid → order_line_items,
  quantity        int NOT NULL,
  PRIMARY KEY (fulfillment_id, line_item_id)
)
```

### `refunds`
```sql
refunds (
  id              uuid PK,
  order_id        uuid → orders NOT NULL,
  shop_id         uuid → shops NOT NULL,
  amount          numeric(12,2) NOT NULL,
  reason          text,
  note            text,
  refunded_by     uuid → auth.users,
  beam_refund_id  text,
  created_at
)
```

---

## 6. Discounts (Rule Engine)

### `discounts`
```sql
discounts (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  code            text,                     -- "SUMMER20" — NULL = automatic
  title           text NOT NULL,
  status          text NOT NULL,            -- active | expired | scheduled | disabled

  -- ประเภท
  type            text NOT NULL,            -- percentage | fixed_amount | free_shipping | bxgy
  value           numeric(12,2),            -- 20 (% หรือ บาท)
  applies_to      text NOT NULL,            -- all | products | collections
  target_ids      uuid[] DEFAULT '{}',

  -- เงื่อนไข
  minimum_amount  numeric(12,2),
  minimum_quantity int,
  customer_eligibility text NOT NULL,       -- all | specific
  customer_ids    uuid[] DEFAULT '{}',

  -- limits
  usage_limit         int,                  -- รวม
  usage_limit_per_customer int,
  used_count      int NOT NULL DEFAULT 0,

  -- เวลา
  starts_at, ends_at timestamptz,

  -- combinations
  combines_with   jsonb DEFAULT '{"product":false,"order":false,"shipping":false}',

  created_at, updated_at,
  UNIQUE (shop_id, code) WHERE code IS NOT NULL
)
CREATE INDEX ON discounts(shop_id, status);
```

### `discount_usages`
```sql
discount_usages (
  id              uuid PK,
  discount_id     uuid → discounts NOT NULL,
  customer_id     uuid → customers NULL,
  order_id        uuid → orders NOT NULL,
  shop_id         uuid → shops NOT NULL,
  used_at         timestamptz NOT NULL DEFAULT now()
)
CREATE INDEX ON discount_usages(discount_id, customer_id);
```

---

## 7. Payment, Shipping & Tax

### `tax_rates`
```sql
tax_rates (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  name            text NOT NULL,           -- "VAT", "Sales Tax CA"
  rate            numeric(5,4) NOT NULL,   -- 0.0700 = 7%
  country         text,                    -- 'TH'
  province        text,                    -- NULL = all of country
  applies_to      text DEFAULT 'all',      -- all | shipping | product
  is_compound     boolean DEFAULT false,   -- ภาษีซ้อน (tax on tax)
  is_default      boolean DEFAULT false,
  priority        int DEFAULT 0,
  created_at, updated_at,
  UNIQUE (shop_id, country, province, applies_to)
)
CREATE INDEX ON tax_rates(shop_id, country, province);
```

**Shop-level tax settings** (เก็บใน `shops.settings.tax`):
```jsonc
{
  "enabled": true,                   // ร้านจด VAT (false = ไม่ออกภาษีเลย)
  "tax_id": "0107...",               // เลขผู้เสียภาษีของร้าน (สำหรับใบกำกับ)
  "default_rate": 0.07,              // VAT 7%
  "mode": "inclusive_customer",      // inclusive_customer | exclusive_customer | shop_absorbs
  "shipping_taxable": true,
  "rounding": "line"                 // line | total
}
```

**3 Tax modes (ดู [ARCHITECTURE.md#tax-calculation](ARCHITECTURE.md#tax-calculation)):**
- `inclusive_customer` — ราคา 107 รวม VAT, customer จ่าย 107, ร้านได้ 100, ส่งรัฐ 7
- `exclusive_customer` — ราคา 100, +VAT 7 ตอน checkout, customer จ่าย 107
- `shop_absorbs` — ราคา 100, customer จ่าย 100, ร้านส่ง VAT จาก revenue → ได้ 93

### `payment_providers`
```sql
payment_providers (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  provider        text NOT NULL,           -- beam (อนาคต: stripe, omise)
  vault_secret_id text NOT NULL,           -- reference ใน Supabase Vault
  is_enabled      boolean DEFAULT true,
  is_test_mode    boolean DEFAULT false,
  config          jsonb,                   -- non-secret config
  created_at, updated_at,
  UNIQUE (shop_id, provider)
)
```

### `payments`
```sql
payments (
  id              uuid PK,
  order_id        uuid → orders NOT NULL,
  shop_id         uuid → shops NOT NULL,
  provider        text NOT NULL,
  provider_charge_id text,                 -- id ฝั่ง Beam
  payment_link_id text,                     -- Beam payment link id
  amount          numeric(12,2) NOT NULL,
  status          text NOT NULL,           -- pending | succeeded | failed | refunded | cancelled
  payment_method  text,                     -- card | promptpay | etc
  failure_reason  text,
  raw_response    jsonb,                    -- debug
  paid_at         timestamptz,
  created_at, updated_at
)
CREATE INDEX ON payments(provider_charge_id);
CREATE INDEX ON payments(order_id);
```

### `shipping_zones` & `shipping_rates`
```sql
shipping_zones (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  name            text NOT NULL,           -- "ในประเทศ", "ต่างประเทศ"
  countries       text[] NOT NULL,
  provinces       text[]
)

shipping_rates (
  id              uuid PK,
  zone_id         uuid → shipping_zones NOT NULL,
  shop_id         uuid → shops NOT NULL,
  name            text NOT NULL,           -- "EMS", "Kerry"
  type            text NOT NULL,           -- flat | weight_based | price_based
  price           numeric(12,2),
  conditions      jsonb,                    -- {min_weight, max_weight, min_price, max_price}
  is_active       boolean DEFAULT true
)
```

---

## 8. Theme System

### `themes` (system-managed)
Theme ที่ platform ship — ไม่ใช่ per-shop (ไม่มี `shop_id`)

```sql
themes (
  id              uuid PK,
  code            text UNIQUE NOT NULL,    -- 'minimal' | 'classic' | 'bold' | 'showcase' | 'boutique'
  name            text NOT NULL,
  description     text,
  category        text,                    -- fashion | food | art | beauty | general
  preview_image_r2_key text,
  thumbnail_r2_key text,

  version         text NOT NULL,           -- semver e.g. "1.0.0"
  schema          jsonb NOT NULL,          -- settings_schema + sections + templates declaration

  is_active       boolean DEFAULT true,
  available_on_plans uuid[] DEFAULT '{}',  -- empty = all plans
  released_at     timestamptz,
  deprecated_at   timestamptz,
  created_at, updated_at,
  UNIQUE (code, version)
)
```

### `shop_theme_settings`
1 row ต่อ shop — เก็บทั้ง published และ draft state

```sql
shop_theme_settings (
  shop_id         uuid PK → shops,
  theme_id        uuid → themes NOT NULL,
  theme_code      text NOT NULL,           -- denormalized: 'minimal' (snapshot)
  theme_version   text NOT NULL,           -- pinned version

  -- published (live state)
  settings        jsonb NOT NULL DEFAULT '{}',  -- global: colors, fonts, header, footer
  templates       jsonb NOT NULL DEFAULT '{}',  -- per-page sections
  published_at    timestamptz,
  published_by    uuid → auth.users,

  -- draft (editor preview before publish)
  draft_settings  jsonb,
  draft_templates jsonb,
  draft_updated_at timestamptz,
  draft_updated_by uuid → auth.users,

  updated_at      timestamptz NOT NULL DEFAULT now()
)
```

**Templates JSON shape:**
```jsonc
{
  "home": {
    "sections": [
      { "id": "hero-1", "type": "Hero",
        "settings": { "heading": "...", "background_asset_id": "..." },
        "blocks": [] },
      { "id": "fp-1", "type": "FeaturedProducts",
        "settings": { "collection_id": "...", "limit": 8 } }
    ]
  },
  "product": { "locked": true },        // [MVP] ไม่ให้แก้
  "collection": { "locked": true },     // [MVP] ไม่ให้แก้
  "cart": { "locked": true }
}
```

**Settings JSON shape:**
```jsonc
{
  "colors": { "primary": "#000", "secondary": "#666", "background": "#fff", "text": "#111" },
  "typography": { "heading_font": "Inter", "body_font": "Inter", "scale": "default" },
  "header": { "style": "minimal", "sticky": true, "show_search": true },
  "footer": { "style": "compact", "show_newsletter": true },
  "layout": { "max_width": "1280px", "spacing": "comfortable" }
}
```

### `shop_theme_assets`
รูปภาพและ asset ที่ใช้ใน theme (logo, favicon, section images)

```sql
shop_theme_assets (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  key             text NOT NULL,           -- 'logo' | 'favicon' | section asset id
  uuid            uuid NOT NULL UNIQUE,    -- ใช้ใน R2 path (เหมือน product_images)
  ext             text NOT NULL,
  r2_key_orig     text NOT NULL,
  alt             text,
  width, height   int,
  bytes           int,
  variants_status text NOT NULL DEFAULT 'pending',  -- เหมือน product_images
  created_at, updated_at, deleted_at,
  UNIQUE (shop_id, key) WHERE deleted_at IS NULL
)
```

Variant URL pattern เหมือน product image: `cdn.yourapp.com/shops/{shop_id}/img/{uuid}/{low|mid|high}.webp`

### `theme_draft_tokens`
short-lived token สำหรับ editor iframe authenticate เพื่อดู draft

```sql
theme_draft_tokens (
  token           text PK,                 -- random opaque
  shop_id         uuid → shops NOT NULL,
  user_id         uuid → auth.users NOT NULL,
  expires_at      timestamptz NOT NULL,    -- ~1 hour
  created_at
)
CREATE INDEX ON theme_draft_tokens(expires_at);
```

### Add field to `shops`
```sql
-- เพิ่มใน shops:
-- theme_id uuid → themes NULL    -- NULL = ใช้ default theme
```

---

## 9. CRM & Loyalty

> **Phase tags:** `[MVP]` รวมในเฟสแรก, `[P2]` Phase 2, `[P3]` Phase 3
> ดู [ARCHITECTURE.md#crm--loyalty](ARCHITECTURE.md#crm--loyalty) สำหรับ flow

### `customer_groups` `[MVP]`
```sql
customer_groups (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  name            text NOT NULL,           -- "VIP", "Wholesale"
  description     text,
  type            text NOT NULL,           -- manual | automatic
  rules           jsonb,                   -- automatic: { min_lifetime_spend: 10000, ... }
  perks           jsonb DEFAULT '{}',      -- { price_list_id, free_shipping, discount_pct }
  created_at, updated_at,
  UNIQUE (shop_id, name)
)

customer_group_members (
  group_id        uuid → customer_groups,
  customer_id     uuid → customers,
  shop_id         uuid → shops NOT NULL,
  added_at        timestamptz NOT NULL DEFAULT now(),
  added_by        text NOT NULL,           -- manual | rule | api
  PRIMARY KEY (group_id, customer_id)
)
```

### `customer_notes` `[MVP]`
```sql
customer_notes (
  id              uuid PK,
  customer_id     uuid → customers NOT NULL,
  shop_id         uuid → shops NOT NULL,
  note            text NOT NULL,
  is_pinned       boolean DEFAULT false,
  created_at, created_by uuid → auth.users
)
```

### `customer_events` `[P2]` (timeline)
```sql
customer_events (
  id              uuid PK,
  customer_id     uuid → customers NOT NULL,
  shop_id         uuid → shops NOT NULL,
  type            text NOT NULL,           -- signup | first_order | abandoned_cart | review_posted | tier_upgraded | birthday
  payload         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
)
CREATE INDEX ON customer_events(shop_id, customer_id, created_at DESC);
```

---

### `loyalty_programs` `[MVP]`
1 active program ต่อร้าน (constraint บังคับด้วย partial unique index)

```sql
loyalty_programs (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  name            text NOT NULL,           -- "Pipe Rewards"
  is_active       boolean DEFAULT true,

  -- earn config
  earn_rate_amount        numeric(12,2) NOT NULL,  -- จ่าย X บาท ได้ 1 คะแนน (e.g., 10.00)
  earn_on_subtotal        boolean DEFAULT true,    -- คิดจาก subtotal หรือ total (รวมค่าส่ง)
  earn_excludes_discounts boolean DEFAULT true,    -- หักส่วนลดก่อนคิดแต้มไหม
  signup_bonus_points     int DEFAULT 0,

  -- redeem config
  redeem_min_points       int NOT NULL DEFAULT 100,
  redeem_value_per_point  numeric(12,4) NOT NULL,  -- 1 คะแนน = ? บาท (e.g., 0.1000)
  redeem_step             int DEFAULT 1,           -- ใช้เป็น multiple of N
  redeem_max_pct_of_order numeric(5,2),            -- ไม่เกินกี่ % ของ order total

  -- expiry
  points_expiry_months    int,                     -- NULL = ไม่หมดอายุ
  expiry_warning_days     int DEFAULT 30,          -- email เตือนก่อนหมด

  terms_url       text,
  created_at, updated_at,
  UNIQUE (shop_id, name)
)
CREATE UNIQUE INDEX ON loyalty_programs(shop_id) WHERE is_active = true;
```

### `loyalty_tiers` `[P2]`
```sql
loyalty_tiers (
  id              uuid PK,
  program_id      uuid → loyalty_programs NOT NULL,
  shop_id         uuid → shops NOT NULL,
  name            text NOT NULL,           -- Bronze, Silver, Gold, Platinum
  threshold_lifetime_points int NOT NULL,  -- lifetime points ต้องถึงเท่าไรเข้า tier
  earn_multiplier numeric(4,2) DEFAULT 1.0, -- 1.5x, 2x
  perks           jsonb DEFAULT '{}',      -- { free_shipping, birthday_bonus, exclusive_products }
  position        int NOT NULL,
  created_at,
  UNIQUE (program_id, name)
)
```

### `customer_loyalty` `[MVP]` (denormalized cache)
**Source of truth คือ `loyalty_ledger`** — ตารางนี้คือ cache เพื่อ query เร็ว, อัปเดตทุกครั้งที่ ledger เปลี่ยน

```sql
customer_loyalty (
  customer_id     uuid PK → customers,
  shop_id         uuid → shops NOT NULL,
  program_id      uuid → loyalty_programs NOT NULL,
  points_balance  int NOT NULL DEFAULT 0,        -- ยอดปัจจุบัน
  points_lifetime int NOT NULL DEFAULT 0,        -- รวมที่เคยได้ (ไม่ลด เมื่อ redeem) — ใช้คิด tier
  points_expiring_soon int DEFAULT 0,             -- จะหมดอายุใน X วัน
  next_expiry_at  timestamptz,
  tier_id         uuid → loyalty_tiers NULL,     -- [P2]
  tier_achieved_at timestamptz,                   -- [P2]
  enrolled_at     timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
)
CREATE INDEX ON customer_loyalty(shop_id, points_balance);
```

### `loyalty_ledger` `[MVP]` ⚠ APPEND-ONLY
**ห้าม UPDATE/DELETE** — ทุกการเปลี่ยนแปลง insert row ใหม่. RLS policy ต้อง deny update/delete แม้แต่ service role ปกติ (ใช้ migration role เท่านั้น)

```sql
loyalty_ledger (
  id              uuid PK,
  customer_id     uuid → customers NOT NULL,
  shop_id         uuid → shops NOT NULL,
  program_id      uuid → loyalty_programs NOT NULL,

  type            text NOT NULL,           -- earn | redeem | expire | adjust | refund_reverse
  points          int NOT NULL,            -- + (earn) หรือ - (redeem/expire/refund_reverse)
  balance_after   int NOT NULL,            -- snapshot สำหรับ debug

  reason          text NOT NULL,           -- order_paid | signup_bonus | birthday | manual | admin_adjust | review | referral
  reference_type  text,                    -- order | refund | manual | event
  reference_id    uuid,

  expires_at      timestamptz,             -- เฉพาะ type=earn — เมื่อแต้มก้อนนี้จะหมดอายุ

  note            text,                    -- สำหรับ manual adjust
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid → auth.users        -- NULL = system
)
CREATE INDEX ON loyalty_ledger(customer_id, created_at DESC);
CREATE INDEX ON loyalty_ledger(shop_id, type, created_at);
CREATE INDEX ON loyalty_ledger(reference_type, reference_id);
-- สำหรับ expiry job
CREATE INDEX ON loyalty_ledger(expires_at) WHERE type = 'earn' AND expires_at IS NOT NULL;

-- ป้องกัน mutate
CREATE RULE no_update AS ON UPDATE TO loyalty_ledger DO INSTEAD NOTHING;
CREATE RULE no_delete AS ON DELETE TO loyalty_ledger DO INSTEAD NOTHING;
```

### `loyalty_redemptions` `[MVP]`
แยกจาก `discounts` เพราะ semantics ต่างกัน (balance deduction ไม่ใช่ rule)

```sql
loyalty_redemptions (
  id              uuid PK,
  cart_id         uuid → carts NULL,        -- ตอนยังเป็น cart
  order_id        uuid → orders NULL,       -- ตอน order finalized
  customer_id     uuid → customers NOT NULL,
  shop_id         uuid → shops NOT NULL,
  program_id      uuid → loyalty_programs NOT NULL,

  points_used     int NOT NULL CHECK (points_used > 0),
  amount_applied  numeric(12,2) NOT NULL,   -- บาท
  ledger_id       uuid → loyalty_ledger NULL, -- link หลัง finalize

  status          text NOT NULL,            -- pending | applied | reversed | refunded
  created_at, updated_at
)
CREATE INDEX ON loyalty_redemptions(cart_id);
CREATE INDEX ON loyalty_redemptions(order_id);
```

### `referrals` `[P2]`
```sql
referral_codes (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  customer_id     uuid → customers NOT NULL,
  code            text NOT NULL,           -- AUTO-generated, easy to share
  uses_count      int DEFAULT 0,
  created_at,
  UNIQUE (shop_id, code)
)

referrals (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  referrer_id     uuid → customers NOT NULL,
  referee_id      uuid → customers NOT NULL,
  code_used       text NOT NULL,
  status          text NOT NULL,           -- pending | qualified | rewarded | invalid
  qualifying_order_id uuid → orders NULL,  -- order แรกของ referee ที่ทำให้ qualify
  reward_points_referrer int,
  reward_points_referee  int,
  rewarded_at     timestamptz,
  created_at,
  UNIQUE (shop_id, referrer_id, referee_id)
)
```

### Integration กับ orders

ในตาราง `orders` (ดูส่วน 5) มี field ที่เกี่ยวข้อง — เพิ่มดังนี้ในเอกสารหลัก แต่สำคัญพอจะหมายเหตุไว้ที่นี่ด้วย:

```sql
-- เพิ่มใน orders:
-- loyalty_points_earned  int DEFAULT 0      -- snapshot: ได้กี่แต้มจาก order นี้
-- loyalty_points_redeemed int DEFAULT 0     -- snapshot: ใช้ไปกี่แต้ม
-- loyalty_amount_redeemed numeric(12,2) DEFAULT 0  -- snapshot: เป็นบาทเท่าไร
```

---

## 9.5 Marketing & Bulk Ops

### `shop_announcement_bars` `[MVP]`
```sql
shop_announcement_bars (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  is_active       boolean DEFAULT true,

  messages        jsonb NOT NULL,            -- [{ text, link, link_text, icon }]
  rotate_seconds  int DEFAULT 0,             -- 0 = ไม่หมุน

  background_color text,
  text_color      text,

  is_dismissible  boolean DEFAULT true,
  starts_at, ends_at timestamptz,
  show_on         text DEFAULT 'all',        -- all | home_only | exclude_checkout
  countdown_to    timestamptz,

  created_at, updated_at
)
CREATE INDEX ON shop_announcement_bars(shop_id, is_active);
```

### `newsletter_subscribers` `[MVP]`
```sql
newsletter_subscribers (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  email           text NOT NULL,
  customer_id     uuid → customers NULL,    -- link เมื่อ email ตรงกับ customer
  source          text NOT NULL,            -- footer | popup | checkout | manual_import | api
  status          text NOT NULL,            -- subscribed | unsubscribed | bounced

  -- consent (PDPA)
  ip              inet,
  user_agent      text,
  consent_text    text,
  subscribed_at   timestamptz NOT NULL,
  unsubscribed_at timestamptz,
  unsubscribe_token text NOT NULL,           -- HMAC สำหรับ 1-click unsubscribe

  tags            text[] DEFAULT '{}',
  created_at, updated_at,
  UNIQUE (shop_id, email)
)
CREATE INDEX ON newsletter_subscribers(shop_id, status);
```

### `bulk_jobs` `[MVP]`
ใช้สำหรับ CSV import/export tracking

```sql
bulk_jobs (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  type            text NOT NULL,             -- import | export
  resource        text NOT NULL,             -- products | customers | orders | inventory | discounts

  status          text NOT NULL,             -- queued | processing | completed | failed | cancelled

  -- input
  source_r2_key   text,                      -- CSV ที่ upload (สำหรับ import)
  options         jsonb DEFAULT '{}',        -- { update_existing, skip_invalid, ... }

  -- progress
  total_rows      int,
  rows_processed  int DEFAULT 0,
  rows_succeeded  int DEFAULT 0,
  rows_failed     int DEFAULT 0,
  errors          jsonb DEFAULT '[]',        -- [{ row, message }] cap 100

  -- output (export)
  result_r2_key   text,
  result_url      text,                      -- presigned download URL (24h)

  created_at, started_at, completed_at      timestamptz,
  created_by      uuid → auth.users
)
CREATE INDEX ON bulk_jobs(shop_id, created_at DESC);
CREATE INDEX ON bulk_jobs(status) WHERE status IN ('queued', 'processing');
```

---

## 10. LINE Integration `[Phase 2]`

> ดู [ARCHITECTURE.md#line-integration-phase-2](ARCHITECTURE.md#line-integration-phase-2)

### `shop_line_channels` `[P2]`
1 LINE Official Account ต่อร้าน

```sql
shop_line_channels (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  channel_id      text NOT NULL,           -- จาก LINE Developers
  basic_id        text,                    -- @xxxxx (public ID)
  display_name    text,
  channel_secret_vault_id text NOT NULL,   -- reference ใน Supabase Vault
  channel_access_token_vault_id text NOT NULL,
  webhook_path    text NOT NULL UNIQUE,    -- /api/line/webhook/{random_token}
  is_active       boolean DEFAULT true,
  features        jsonb DEFAULT '{}',      -- { push_enabled, rich_menu_enabled, ... }
  created_at, updated_at,
  UNIQUE (shop_id),                        -- 1 channel per shop
  UNIQUE (channel_id)                      -- channel ใช้กับร้านอื่นซ้ำไม่ได้
)
```

### `shop_liff_apps` `[P2]`
หลาย LIFF app ต่อร้าน (storefront, my-orders, points)

```sql
shop_liff_apps (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  channel_id      uuid → shop_line_channels NOT NULL,
  liff_id         text NOT NULL,           -- เลขที่ LINE ออกให้
  type            text NOT NULL,           -- storefront | my_orders | points | custom
  name            text NOT NULL,
  view_url        text NOT NULL,           -- liff.yourapp.com/{shop_slug}/{type}
  size            text NOT NULL,           -- compact | tall | full
  features        jsonb DEFAULT '{}',      -- { share_target_picker, scan_qr, ... }
  is_default      boolean DEFAULT false,
  created_at, updated_at,
  UNIQUE (channel_id, type),
  UNIQUE (liff_id)
)
```

### `customer_line_identities` `[P2]`
LINE-specific data ของลูกค้า (เพิ่มเติมจาก `customer_identities`)

```sql
customer_line_identities (
  id              uuid PK,
  customer_id     uuid → customers NOT NULL,
  shop_id         uuid → shops NOT NULL,
  channel_id      uuid → shop_line_channels NOT NULL,
  line_user_id    text NOT NULL,            -- userId จาก LINE (per channel)
  display_name    text,
  picture_url     text,
  status_message  text,
  language        text,

  -- bot relationship
  is_following    boolean DEFAULT false,    -- follow OA หรือยัง
  followed_at, unfollowed_at, blocked_at timestamptz,

  -- notification preferences
  notifications_enabled    boolean DEFAULT true,
  marketing_enabled        boolean DEFAULT false,  -- opt-in แยก
  transactional_only       boolean DEFAULT false,

  last_seen_at    timestamptz,
  last_message_at timestamptz,
  created_at, updated_at,
  UNIQUE (channel_id, line_user_id)
)
```

### `shop_line_rich_menus` `[P2]`
```sql
shop_line_rich_menus (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  channel_id      uuid → shop_line_channels NOT NULL,
  name            text NOT NULL,
  size            text NOT NULL,            -- 2500x1686 | 2500x843 | etc
  layout          jsonb NOT NULL,            -- areas, actions
  background_image_r2_key text,
  line_rich_menu_id text,                    -- id หลัง upload ไป LINE
  is_default      boolean DEFAULT false,     -- default menu สำหรับทุก follower
  scope_audience_id uuid,                    -- targeted ถ้ามี (P3)
  created_at, updated_at
)
```

### `line_messages` `[P2]`
log + audit สำหรับทุก push/reply

```sql
line_messages (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  channel_id      uuid → shop_line_channels NOT NULL,
  customer_id     uuid → customers NULL,    -- NULL ถ้าเป็น broadcast
  line_user_id    text,                      -- recipient

  type            text NOT NULL,             -- push | reply | multicast | broadcast
  reason          text NOT NULL,             -- order_paid | points_earned | abandoned_cart | manual | campaign
  reference_type  text,                      -- order | loyalty_ledger | campaign
  reference_id    uuid,

  payload         jsonb NOT NULL,            -- LINE message object
  payload_size    int,                       -- byte count

  status          text NOT NULL,             -- queued | sent | failed | bounced
  line_message_id text,                      -- id ที่ LINE คืนกลับ
  attempts        int DEFAULT 0,
  error           text,

  scheduled_for   timestamptz,               -- delay ตาม quiet hours
  sent_at         timestamptz,
  created_at
)
CREATE INDEX ON line_messages(shop_id, created_at DESC);
CREATE INDEX ON line_messages(status, scheduled_for) WHERE status = 'queued';
```

### `line_audiences` `[P3]`
saved segment สำหรับ broadcast/multicast

```sql
line_audiences (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  name            text NOT NULL,
  rules           jsonb NOT NULL,            -- segment definition
  customer_count  int DEFAULT 0,
  last_synced_at  timestamptz,
  line_audience_id text,                      -- ถ้า upload ไป LINE Audience API
  created_at, updated_at
)
```

---

## 11. Reports & Analytics

### `report_snapshots_daily`
Pre-aggregated สำหรับ dashboard + email digest — recompute ทุกคืนผ่าน cron

```sql
report_snapshots_daily (
  shop_id          uuid → shops NOT NULL,
  date             date NOT NULL,             -- shop's local date

  -- sales
  orders_count     int NOT NULL DEFAULT 0,
  orders_paid      int NOT NULL DEFAULT 0,
  orders_cancelled int NOT NULL DEFAULT 0,
  gross_revenue    numeric(14,2) NOT NULL DEFAULT 0,    -- รวม VAT (customer_pays รวม)
  net_revenue      numeric(14,2) NOT NULL DEFAULT 0,    -- หัก VAT แล้ว (revenue ของร้าน)
  total_tax_collected numeric(14,2) NOT NULL DEFAULT 0, -- จาก customer
  total_tax_owed   numeric(14,2) NOT NULL DEFAULT 0,    -- ที่ต้องส่งรัฐ (รวม shop_absorbs)
  total_discounts  numeric(14,2) NOT NULL DEFAULT 0,
  total_shipping   numeric(14,2) NOT NULL DEFAULT 0,

  -- refunds
  refunds_count    int NOT NULL DEFAULT 0,
  refunds_amount   numeric(14,2) NOT NULL DEFAULT 0,

  -- customers
  customers_new    int NOT NULL DEFAULT 0,
  customers_returning int NOT NULL DEFAULT 0,

  -- units
  units_sold       int NOT NULL DEFAULT 0,

  -- loyalty
  points_earned    int NOT NULL DEFAULT 0,
  points_redeemed  int NOT NULL DEFAULT 0,

  -- pre-computed top items (cap 10 each)
  top_products     jsonb DEFAULT '[]',         -- [{product_id, title, qty, revenue}]
  top_collections  jsonb DEFAULT '[]',
  top_discounts    jsonb DEFAULT '[]',

  computed_at      timestamptz NOT NULL,
  PRIMARY KEY (shop_id, date)
)
CREATE INDEX ON report_snapshots_daily(shop_id, date DESC);
```

### `report_email_subscriptions`
shop_member สมัคร receive email digest

```sql
report_email_subscriptions (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  user_id         uuid → auth.users NOT NULL,
  type            text NOT NULL,            -- daily | weekly | monthly
  recipient_email text NOT NULL,            -- override ได้ default = user.email
  reports         text[] NOT NULL,          -- ['sales_overview', 'tax_collected', 'low_stock', 'top_products']
  is_active       boolean NOT NULL DEFAULT true,
  last_sent_at    timestamptz,
  created_at, updated_at,
  UNIQUE (shop_id, user_id, type)
)
CREATE INDEX ON report_email_subscriptions(type, is_active) WHERE is_active = true;
```

### `report_csv_exports`
Track CSV export job (ใช้ pipeline เดียวกับ `bulk_jobs` แต่แยกตารางเพื่อ query ง่าย — หรือจะใช้ `bulk_jobs.resource = 'report_xxx'` ก็ได้)

> **Decision:** ใช้ `bulk_jobs` ตารางเดียวกัน — `bulk_jobs.resource` รับค่า `'report_sales_overview'`, `'report_tax_collected'`, ... ไม่สร้างตารางแยก

---

## 12. SEO

> ดู [SEO.md](SEO.md) สำหรับ pattern + flow ครบ

### `seo_redirects`
301/302 redirect manager (ใช้ใน middleware ของ storefront)

```sql
seo_redirects (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  from_path       text NOT NULL,           -- '/products/old-handle' หรือ glob '/old/*'
  to_path         text NOT NULL,
  type            int NOT NULL DEFAULT 301, -- 301 | 302
  is_active       boolean DEFAULT true,
  hits_count      int DEFAULT 0,
  last_hit_at     timestamptz,
  created_at, updated_at, created_by uuid → auth.users,
  UNIQUE (shop_id, from_path) WHERE is_active = true
)
CREATE INDEX ON seo_redirects(shop_id, is_active);
```

### Field additions ใน `shops.settings` (jsonb)
```jsonc
{
  "seo": {
    "robots_txt": "...",                           // override default
    "default_og_image_asset_id": "uuid",
    "title_pattern": "{page} - {shop_name}",
    "google_verification": "...",                  // Search Console
    "bing_verification": "..."
  }
}
```

### SEO fields ที่มีอยู่แล้ว (recap)
- `products.seo_title`, `products.seo_description`
- `collections.seo_title`, `collections.seo_description`
- `shop_domains.is_primary` — ใช้กำหนด canonical

---

## 13. Platform Plumbing

### `plans` & `shop_subscriptions`
```sql
plans (
  id              uuid PK,
  name            text NOT NULL,
  monthly_price   numeric(12,2) NOT NULL,
  features        jsonb NOT NULL,           -- {custom_domain: true, api_access: true, ...}
  product_limit   int,
  staff_limit     int
)

shop_subscriptions (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  plan_id         uuid → plans NOT NULL,
  status          text NOT NULL,            -- active | past_due | cancelled
  current_period_start timestamptz NOT NULL,
  current_period_end   timestamptz NOT NULL,
  cancel_at_period_end boolean DEFAULT false,
  created_at, updated_at
)
```

### `webhooks` (ร้านค้าตั้ง webhook ของตัวเอง)
```sql
webhooks (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  url             text NOT NULL,
  topics          text[] NOT NULL,          -- order.created, order.paid, ...
  secret          text NOT NULL,            -- ลูกค้าใช้ verify
  is_active       boolean DEFAULT true,
  created_at, updated_at
)

webhook_deliveries (
  id              uuid PK,
  webhook_id      uuid → webhooks NOT NULL,
  shop_id         uuid → shops NOT NULL,
  topic           text NOT NULL,
  payload         jsonb NOT NULL,
  status          text NOT NULL,            -- pending | success | failed
  response_code   int,
  response_body   text,
  attempts        int NOT NULL DEFAULT 0,
  next_retry_at   timestamptz,
  created_at, delivered_at timestamptz
)
CREATE INDEX ON webhook_deliveries(status, next_retry_at);
```

### `audit_logs`
```sql
audit_logs (
  id              uuid PK,
  shop_id         uuid → shops NOT NULL,
  user_id         uuid → auth.users NULL,
  action          text NOT NULL,            -- product.created, order.refunded, ...
  resource_type   text NOT NULL,
  resource_id     uuid,
  changes         jsonb,                     -- { before: {...}, after: {...} }
  ip              inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
)
CREATE INDEX ON audit_logs(shop_id, created_at DESC);
```

---

## RLS Pattern

```sql
-- Helper
CREATE OR REPLACE FUNCTION auth.shop_ids() RETURNS uuid[] AS $$
  SELECT COALESCE(
    ARRAY(SELECT shop_id FROM shop_members WHERE user_id = auth.uid()),
    '{}'::uuid[]
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Pattern 1: Shop members access (admin)
CREATE POLICY "shop_members_all"
ON products FOR ALL
TO authenticated
USING (shop_id = ANY(auth.shop_ids()))
WITH CHECK (shop_id = ANY(auth.shop_ids()));

-- Pattern 2: Public read (storefront)
CREATE POLICY "public_read_active"
ON products FOR SELECT
TO anon
USING (status = 'active' AND deleted_at IS NULL);

-- Pattern 3: Customer access own data
CREATE POLICY "customer_own_orders"
ON orders FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE auth_user_id = auth.uid()
  )
);
```

**ทุกตาราง** ต้อง enable RLS:
```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;  -- บังคับ owner ของ table ก็ต้องผ่าน RLS
```

**Test:** ใช้ pgTAP สำหรับ RLS test — `apps/admin` และ workers ใช้ service role bypass RLS, แต่ test ต้อง verify ว่า user role ปกติเข้าไม่ได้

---

## Migration Strategy

- ใช้ `drizzle-kit` generate migrations
- Commit migration files ใน `packages/db/migrations/`
- Apply ผ่าน CI ก่อน deploy
- **ห้าม** edit migration ที่ commit แล้ว — ทำ migration ใหม่
- RLS policies เก็บเป็น SQL file แยก, apply หลัง schema migration
