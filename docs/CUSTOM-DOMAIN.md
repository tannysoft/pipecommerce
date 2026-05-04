# Custom Domain + SSL Flow

> ผ่าน Cloudflare for SaaS (Custom Hostnames API)
> Last updated: 2026-05-05

## Overview

ลูกค้า (เจ้าของร้าน) ตั้ง CNAME จาก domain ของตัวเองมาที่แพลตฟอร์ม → Cloudflare ออก SSL อัตโนมัติ → traffic ส่งไปยัง storefront app

```
[shop.example.com]
    ↓ CNAME → cname.yourapp.com
[Cloudflare for SaaS]
    ↓ SSL termination + edge cache
[apps/storefront on CF Workers]
    ↓ middleware lookup shop_id from hostname
[render shop's storefront]
```

---

## Why Cloudflare for SaaS

- ✅ Issue SSL อัตโนมัติ (Let's Encrypt / Google Trust Services)
- ✅ รองรับ hostnames ไม่จำกัด
- ✅ Renewal อัตโนมัติ
- ✅ DDoS protection มาฟรี
- ✅ มี API เต็มสำหรับ provision

ทางเลือกอื่นที่ไม่เลือก:
- ❌ Vercel Custom Domains — ratelimit, ราคาสูงตอนเยอะ
- ❌ Self-host Caddy + Let's Encrypt — ต้องมี server ตลอดเวลา ขัดแนวคิด serverless

---

## Provisioning Flow

### Step 1 — เจ้าของร้านเพิ่ม domain ใน admin

```
POST /api/shops/{shopId}/domains
Body: { hostname: "shop.example.com" }
```

### Step 2 — Backend เรียก Cloudflare API

```ts
// packages/core/domains/provision.ts
async function addCustomHostname(hostname: string) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/custom_hostnames`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname,
        ssl: {
          method: 'http',           // หรือ 'txt' สำหรับ DNS-01
          type: 'dv',
          settings: { min_tls_version: '1.2' },
        },
      }),
    }
  )
  const { result } = await res.json()
  // result.id, result.status = "pending" | "active" | ...
  return result
}
```

เก็บ `cf_hostname_id` ลง `shop_domains.cf_hostname_id`

### Step 3 — แสดง instruction ให้ลูกค้า

```
ไปที่ DNS provider ของคุณ และเพิ่ม:

  Type:  CNAME
  Name:  shop  (หรือ @ ถ้าเป็น root domain)
  Value: cname.yourapp.com

* root domain (example.com) อาจต้องใช้ ALIAS / ANAME หรือ CNAME flattening
  ที่ DNS providers รองรับ (Cloudflare DNS, Route53, DNSimple)
```

UI ควรแสดง:
- DNS record ที่ต้องตั้ง
- Status indicator (pending / active / failed)
- ปุ่ม "ตรวจสอบอีกครั้ง"

### Step 4 — Verification

**Option A: Polling (เริ่มต้นแบบนี้)**

```ts
// CF Cron Trigger ทุก 1 นาที
async function checkPendingDomains() {
  const pending = await db.query.shopDomains.findMany({
    where: eq(shopDomains.sslStatus, 'pending'),
  })
  for (const d of pending) {
    const status = await cfGetCustomHostname(d.cfHostnameId)
    if (status.status === 'active' && status.ssl.status === 'active') {
      await db.update(shopDomains)
        .set({ sslStatus: 'active', verifiedAt: new Date() })
        .where(eq(shopDomains.id, d.id))
      // optional: enqueue email notification ให้เจ้าของร้าน
    }
  }
}
```

**Option B: Cloudflare Notifications webhook** (แนะนำเมื่อ scale)
- ตั้ง notification policy ใน CF dashboard
- ยิง webhook มาที่ `/api/webhooks/cloudflare/hostname`
- Process แล้ว update status

### Step 5 — Request เข้ามาที่ Worker

```ts
// apps/storefront/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

const PLATFORM_DOMAIN = 'yourapp.com'

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host')!.toLowerCase()
  const url = req.nextUrl.clone()

  // ข้าม root marketing site, admin, api ภายใน
  if (host === PLATFORM_DOMAIN || host === `www.${PLATFORM_DOMAIN}`) {
    return NextResponse.next()
  }
  if (host.startsWith('admin.')) return NextResponse.next()

  // Lookup shop จาก hostname (KV cache → Postgres fallback)
  const shop = await lookupShopByHost(host)
  if (!shop) {
    return new NextResponse('Shop not found', { status: 404 })
  }

  // ทำ internal rewrite ไป /_storefront/{shopId}/{path}
  url.pathname = `/_storefront/${shop.id}${url.pathname}`
  const res = NextResponse.rewrite(url)
  res.headers.set('x-shop-id', shop.id)
  res.headers.set('x-shop-currency', shop.currency)
  return res
}

async function lookupShopByHost(host: string) {
  // 1. Try KV cache (TTL ~5 min)
  const cached = await env.SHOP_KV.get(`host:${host}`, 'json')
  if (cached) return cached

  // 2. Postgres
  const shop = await db.query.shopDomains.findFirst({
    where: and(
      eq(shopDomains.hostname, host),
      eq(shopDomains.sslStatus, 'active')
    ),
    with: { shop: true },
  })
  if (!shop) return null

  // 3. Cache
  await env.SHOP_KV.put(`host:${host}`, JSON.stringify(shop.shop), {
    expirationTtl: 300,
  })
  return shop.shop
}
```

**สำคัญ:** ต้อง invalidate KV เมื่อ:
- ร้านลบ domain → `KV.delete('host:...')`
- ร้านเปลี่ยน status → `KV.delete(...)`

---

## Edge Cases

### Apex domain (example.com)
- DNS ทั่วไปไม่อนุญาต CNAME ที่ root record
- แนะนำ DNS provider ที่มี ALIAS/ANAME (Cloudflare DNS, Route53, DNSimple)
- หรือให้ลูกค้าใช้ A record ชี้ IP ที่ Cloudflare ให้ (จาก CF Custom Hostnames)

### www vs non-www
- รับทั้ง 2 → redirect ไป primary domain ใน middleware

### โดเมนชี้ไปที่อื่นอยู่
- Cloudflare verify ไม่ผ่าน → status = `pending_validation` ตลอด
- แสดง error ชัดเจนใน admin UI พร้อมลิงก์ help

### Domain expired / DNS เปลี่ยน
- Cloudflare revoke SSL → traffic หยุด
- ตั้ง alert + email เจ้าของร้านอัตโนมัติเมื่อ status เปลี่ยนเป็น `failed`/`revoked`

### Let's Encrypt rate limit
- 50 cert/domain/week
- Cloudflare จัดการให้ส่วนใหญ่ — แต่ระวังถ้าทำ bulk add/remove

### Subdomain ของลูกค้า
- ลูกค้าตั้ง multiple subdomain (shop.example.com, store.example.com) ได้
- ทุกอันเป็น row แยกใน `shop_domains`

---

## API Endpoints (Admin)

```
POST   /api/shops/{shopId}/domains
       → add domain, call CF API, return DNS instructions

GET    /api/shops/{shopId}/domains
       → list with current SSL status

POST   /api/shops/{shopId}/domains/{id}/verify
       → re-check status from CF

DELETE /api/shops/{shopId}/domains/{id}
       → remove domain, call CF DELETE, invalidate KV

PUT    /api/shops/{shopId}/domains/{id}/primary
       → set as primary (unset others, only one primary per shop)
```

---

## Cost Considerations

- **Cloudflare for SaaS Custom Hostnames:**
  - 100 hostnames ฟรีในบาง plan
  - หลังจากนั้น $0.10–$2/hostname/month แล้วแต่ tier
  - ตรวจสอบราคาปัจจุบันที่ Cloudflare ก่อน scale

- **DNS validation cost:** ฟรี (LE)
- **SSL renewal:** ฟรี + อัตโนมัติ

---

## Security Notes

- API token ของ Cloudflare ต้องมี scope แค่ `Zone:Custom Hostnames:Edit` — ไม่ให้ token ที่กว้างกว่านี้
- เก็บ token ใน Worker secrets หรือ Supabase Vault, **ห้าม** commit
- ทุก provision/delete log ใน `audit_logs`
- Rate limit endpoint `POST /domains` ต่อ shop (e.g., 10/hour) กัน abuse

---

## Future Enhancements

1. **Auto SSL renewal monitoring** — alert ก่อน expire 7 วัน
2. **Wildcard support** — `*.example.com` สำหรับร้านที่ต้องการหลาย subdomain
3. **HSTS preload** — เพิ่มความปลอดภัย
4. **CAA records** — ตรวจสอบ DNS CAA ของ user เพื่อ debug ปัญหา SSL
