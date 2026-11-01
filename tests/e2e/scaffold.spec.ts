import { expect, test } from '@playwright/test'

test('the React entry point and local Worker load together', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')
  await expect(page).toHaveTitle('Quibble')
  await expect(page.getByRole('heading', { name: 'Make your case.', level: 1 })).toBeVisible()
  const health = await request.get('/api/health')
  expect(health.status()).toBe(200)
  expect(await health.json()).toEqual({ status: 'ok' })

  // An unimplemented API path must not return the SPA's HTML.
  const missing = await request.get('/api/not-implemented')
  expect(missing.status()).toBe(404)
  expect(missing.headers()['content-type']).toContain('application/json')
  expect(errors).toEqual([])
})

test('planned routes match on direct loads and refreshes', async ({ page }) => {
  const routes = [
    ['/', 'home'],
    ['/play', 'library'],
    ['/play/oddly-specific/1', 'game'],
    ['/about', 'not-found'], // P1 is built in a later phase
    ['/not-a-route', 'not-found'],
  ] as const

  for (const [path, scene] of routes) {
    await page.goto(path)
    await expect(page.getByRole('main')).toHaveAttribute('data-scene', scene)
    await page.reload()
    await expect(page.getByRole('main')).toHaveAttribute('data-scene', scene)
  }
})

// 3.11: every page and the on-device judge's worker script carry the policy, and a
// game loads under it without violations.
test('pages and the worker script are served with the content security policy', async ({ page, request }) => {
  const violations: string[] = []
  page.on('console', (message) => { if (message.text().includes('Content Security Policy')) violations.push(message.text()) })
  const response = await page.goto('/play/oddly-specific/1')
  const policy = response?.headers()['content-security-policy'] ?? ''
  // Turnstile, and Cloudflare Web Analytics' beacon (D-69).
  expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com;")
  expect(policy).toContain('connect-src \'self\' https://huggingface.co https://*.hf.co')
  expect(policy).toContain("frame-ancestors 'none'")
  // The worker's file name is hashed, so read it from the app's bundle.
  const bundle = await page.evaluate(() => performance.getEntriesByType('resource').map(({ name }) => name).find((name) => /\/assets\/index-.*\.js$/u.test(name)))
  expect(bundle).toBeDefined()
  const script = await request.get(String(bundle))
  const workerPath = /worker-[\w-]+\.js/u.exec(await script.text())?.[0]
  expect(workerPath).toBeDefined()
  expect((await request.get(`/assets/${String(workerPath)}`)).headers()['content-security-policy']).toBe(policy)
  await expect(page.getByRole('textbox')).toBeVisible()
  expect(violations).toEqual([])
})
