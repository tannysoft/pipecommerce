/**
 * Sanitize HTML จาก rich-text editor ก่อน render
 *
 * Threat model: shop owner เป็น admin ของร้าน — โดน account takeover แล้ว
 * พิมพ์ <script> ใส่ใน body ได้ ลูกค้า browse storefront จะโดน XSS
 *
 * Defense-in-depth — Tiptap output ปกติไม่มี <script> อยู่แล้ว แต่กัน edge case
 *
 * Implementation: regex-based — เพราะ DOMPurify/jsdom ใช้ใน CF Workers ไม่ได้
 * (ไม่มี MessagePort + DOM API). เพียงพอสำหรับ trusted-source content
 *
 * Block:
 *   - <script>, <iframe>, <object>, <embed>, <form>, <style> tags
 *   - on* event handlers
 *   - javascript:/data:/vbscript: URLs ใน href/src
 */

const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'style']

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''

  let s = dirty

  // 1. Strip dangerous tags + content (block-level removal)
  for (const tag of DANGEROUS_TAGS) {
    const re = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi')
    s = s.replace(re, '')
    // Self-closing variants
    s = s.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '')
  }

  // 2. Strip event handlers (onerror, onclick, etc.) — match space + on... + =
  s = s.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
  s = s.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
  s = s.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')

  // 3. Strip dangerous URL schemes ใน href/src
  s = s.replace(
    /\s(href|src|formaction|action)\s*=\s*"\s*(javascript|data|vbscript)\s*:[^"]*"/gi,
    ' $1="#"',
  )
  s = s.replace(
    /\s(href|src|formaction|action)\s*=\s*'\s*(javascript|data|vbscript)\s*:[^']*'/gi,
    " $1='#'",
  )

  return s
}
