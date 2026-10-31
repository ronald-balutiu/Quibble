import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// The on-device judge's WebGPU runtime (the asyncify build that onnxruntime-web/webgpu
// loads, 28.7 MB) is over the 25 MiB static asset limit, so it ships gzipped (7.1 MB)
// and src/judges/device/worker.ts unpacks it.
const ORT_RUNTIME = 'ort/runtime.wasm.gz'
function ortRuntime(): Plugin {
  const packed = () => gzipSync(readFileSync(fileURLToPath(new URL('./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm', import.meta.url))))
  return {
    name: 'quibble:ort-runtime',
    applyToEnvironment: (environment) => environment.name === 'client',
    configureServer(server) {
      server.middlewares.use(`/${ORT_RUNTIME}`, (_request, response) => {
        response.setHeader('Content-Type', 'application/gzip')
        response.end(packed())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: ORT_RUNTIME, source: packed() })
    },
  }
}

// onnxruntime-web's bundle also emits the raw runtime for its fallback path. The
// worker always passes the unpacked binary instead, so that copy is never fetched.
function dropRawOrtRuntime(): Plugin {
  return {
    name: 'quibble:drop-raw-ort-runtime',
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle)) if (/ort-wasm-simd-threaded\.[\w.-]*\.wasm$/u.test(name)) Reflect.deleteProperty(bundle, name)
    },
  }
}

export default defineConfig({
  plugins: [react(), cloudflare({ viteEnvironment: { name: 'worker' } }), ortRuntime()],
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
  // The on-device judge runs in a lazy-loaded module worker.
  worker: { format: 'es', plugins: () => [dropRawOrtRuntime()] },
})
