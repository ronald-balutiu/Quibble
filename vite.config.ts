import { fileURLToPath, URL } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { dropRawOrtRuntime, ortRuntime, routePages, sitemap } from './scripts/vite-plugins.ts'

export default defineConfig({
  // Browser tests mock every model call, so their preview server runs without remote
  // bindings and needs no Cloudflare login (CI has none).
  plugins: [react(), cloudflare({ viteEnvironment: { name: 'worker' }, remoteBindings: process.env.QUIBBLE_REMOTE_BINDINGS !== 'false' }), ortRuntime(), sitemap(), routePages()],
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
  environments: {
    client: {
      build: {
        rolldownOptions: {
          output: {
            // React and the router change rarely, so their own chunk keeps its hash,
            // and stays cached for a year (public/_headers), across deploys that
            // change only app code.
            codeSplitting: { groups: [{ name: 'react', test: /node_modules[\\/](?:react|react-dom|react-router|scheduler)[\\/]/u }] },
          },
        },
      },
    },
  },
  // The on-device judge runs in a lazy-loaded module worker.
  worker: { format: 'es', plugins: () => [dropRawOrtRuntime()] },
})
