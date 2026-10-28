import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    // Keep pure unit tests independent of the Cloudflare development runtime.
    environment: 'node',
    include: ['tests/unit/{app,worker,shared,tooling}/**/*.test.{ts,tsx}'],
    allowOnly: !process.env.CI,
    globals: false,
    // Unit tests should use fake timers for the judges' 10-second timeouts.
    testTimeout: 5_000,
    hookTimeout: 10_000,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
