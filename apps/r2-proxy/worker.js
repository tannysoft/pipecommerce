/**
 * R2 passthrough worker — สำหรับ files.pipecommerce.com
 *
 * ทำไมต้องมี:
 *   storefront worker จับ wildcard *.pipecommerce.com/* ทำให้ R2 custom domain
 *   ของ files.* ถูก intercept ก่อน → ไม่เห็น R2 binding
 *
 * Solution: เพิ่ม stub worker ที่ pattern เจาะจงกว่า (`files.pipecommerce.com/*`)
 *   route specificity ทำให้ทับ wildcard. Worker นี้ใช้ R2 binding ตรงๆ
 *   ไม่ต้องผ่าน HTTP fetch อีกรอบ → fast + cheap
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const key = url.pathname.replace(/^\//, '')

    if (!key) return new Response('Not found', { status: 404 })

    // Disallow listing / sensitive paths (pre-check)
    if (key.startsWith('_') || key.includes('..')) {
      return new Response('Forbidden', { status: 403 })
    }

    // GET / HEAD only
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { allow: 'GET, HEAD' },
      })
    }

    const obj = await env.BUCKET.get(key)
    if (!obj) return new Response('Not found', { status: 404 })

    const headers = new Headers()
    obj.writeHttpMetadata(headers)
    headers.set('etag', obj.httpEtag)
    headers.set('cache-control', 'public, max-age=31536000, immutable')

    return new Response(request.method === 'HEAD' ? null : obj.body, {
      headers,
    })
  },
}
