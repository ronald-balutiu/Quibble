import { defineConfig } from '@playwright/test'

// Local only: the on-device judge with the real model in Google Chrome on WebGPU
// (Phase 5). It downloads ~570 MB per run, so CI never runs it. See
// CONTRIBUTING.md for when to run it.
export default defineConfig({
  testDir: './tests/device',
  workers: 1,
  timeout: 300_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    launchOptions: { args: ['--enable-unsafe-webgpu'] },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
