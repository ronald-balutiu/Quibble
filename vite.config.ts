import { fileURLToPath, URL } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), cloudflare({ viteEnvironment: { name: 'worker' } })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // The local plan contains private notes and preview-only assets.
    fs: { deny: ['.env', '.env.*', '.dev.vars*', '**/*.{crt,pem}', '**/.git/**', '**/plan/**'] },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  // The on-device judge will use a lazy-loaded module worker.
  worker: { format: 'es' },
})
