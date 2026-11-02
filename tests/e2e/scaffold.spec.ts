import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('the React entry point and local Worker load together', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')
  await expect(page).toHaveTitle('Quibble · Three word games judged by AI')
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
    ['/about', 'about'],
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
  // The on-device client may live in a deferred dependency. Inspect the scripts
  // actually loaded for gameplay rather than assuming a single application file.
  await expect(page.getByRole('textbox')).toBeVisible()
  const bundles = await page.evaluate(() => performance.getEntriesByType('resource').map(({ name }) => name).filter((name) => /\/assets\/.*\.js$/u.test(name)))
  const scripts = await Promise.all(bundles.map(async (url) => (await request.get(url)).text()))
  const workerPath = /worker-[\w-]+\.js/u.exec(scripts.join('\n'))?.[0]
  expect(workerPath).toBeDefined()
  expect((await request.get(`/assets/${String(workerPath)}`)).headers()['content-security-policy']).toBe(policy)
  await expect(page.getByRole('textbox')).toBeVisible()
  expect(violations).toEqual([])
})

// Search engines: robots.txt points to the sitemap, which lists Home, the Library and
// every puzzle; each page has its own title and canonical URL, and unknown paths ask
// not to be indexed (the single-page fallback serves them with a 200).
test('crawlers find every puzzle, and each page names itself', async ({ page, request }) => {
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Sitemap: https://quibble.ronaldbalutiu.com/sitemap.xml')
  expect(robots).toContain('Disallow: /api/')
  const sitemap = await (await request.get('/sitemap.xml')).text()
  const index = JSON.parse(readFileSync('public/puzzles/index.json', 'utf8')) as Record<string, unknown[]>
  const puzzles = Object.values(index).reduce((sum, list) => sum + list.length, 0)
  expect(sitemap.match(/<loc>/gu)).toHaveLength(puzzles + 3)
  expect(sitemap).toContain('<loc>https://quibble.ronaldbalutiu.com/play/double-agent/1</loc>')

  await page.goto('/play/category-escape/7')
  await expect(page).toHaveTitle('Category Escape #007 · Quibble')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://quibble.ronaldbalutiu.com/play/category-escape/7')
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0)

  await page.goto('/no-such-page')
  await expect(page).toHaveTitle('Not found · Quibble')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
})
