import { defineCloudflareConfig } from '@opennextjs/cloudflare'

export default defineCloudflareConfig({
  // Enable R2 incremental cache + KV for ISR ตอนผูก binding ใน wrangler.toml แล้ว
  // ดู docs/ARCHITECTURE.md#hosting--domain-layout
})
