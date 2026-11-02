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
    // npm run test:coverage, run by CI: the logic modules (plain .ts), not React
    // components, which the Playwright suite covers. Excluded are files that only run
    // in a real browser or with the real model: the on-device worker (npm run
    // test:device and tests/e2e/device.spec.ts) and the Turnstile loader (the live
    // site). The thresholds sit just under today's numbers, so coverage can't slide.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'shared/**/*.ts', 'worker/**/*.ts', 'eval/results.ts'],
      exclude: ['src/judges/device/worker.ts', 'src/lib/turnstile.ts', 'src/prerender.tsx', '**/*.d.ts'],
      reporter: ['text-summary'],
      thresholds: { lines: 85, statements: 82, functions: 84, branches: 75 },
    },
  },
})
