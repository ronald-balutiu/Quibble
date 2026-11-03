import { loadConfigFromFile } from 'vite'
import { expect, test, vi } from 'vitest'

// Vite plans to load configs with Node's native loader by default. vite.config.ts
// pulls in scripts/vite-plugins.ts and, through it, part of shared/, so every import
// on that path must resolve without a bundler.
vi.setConfig({ testTimeout: 30_000 })

test('the Vite config loads with the native config loader', async () => {
  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    undefined,
    process.cwd(),
    'silent',
    undefined,
    'native',
  )

  expect(loaded?.config.plugins?.length).toBeGreaterThan(0)
})
