import { expect, test } from '@playwright/test'

test('the React entry point and local Worker load together', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')
  await expect(page).toHaveTitle('Quibble')
  await expect(page.getByRole('heading', { name: 'Quibble', level: 1 })).toBeVisible()
  await expect(page.getByText('Make your case.')).toBeVisible()
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
