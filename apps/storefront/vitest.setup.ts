// Expose Web Crypto API as global on Node 18 (Node 20+ มี global crypto แล้ว)
import { webcrypto } from 'node:crypto'
if (!globalThis.crypto) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).crypto = webcrypto
}
