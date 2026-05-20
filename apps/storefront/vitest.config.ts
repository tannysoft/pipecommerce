import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
    setupFiles: ['./vitest.setup.ts'],
    css: false,
  },
  // ปิด PostCSS/Tailwind processing ตอนเทส — เราเทสแค่ pure functions
  css: {
    postcss: { plugins: [] },
  },
})
