import { expect, test } from '@playwright/test'

test('Home defers comparison data and code until opened, then shares the data with About', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => { requests.push(request.url()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Three ways to play' })).toBeVisible()
  expect(requests.filter((url) => /\/eval\/results.json|\/puzzles\/index.json|\/assets\/(GameScene|LibraryScene|SettingsContents|ComparisonContent)-/u.test(url))).toEqual([])
  await page.getByText('See the results', { exact: true }).click()
  await expect(page.locator('.compare__summary')).toContainText('81.4%')
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'About', exact: true }).click()
  await expect(page.locator('[data-scene="about"]')).toBeVisible()
  await expect.poll(() => requests.filter((url) => url.endsWith('/eval/results.json')).length).toBe(1)
})

test('failed static data can be retried without reloading', async ({ page }) => {
  let indexCalls = 0
  let evalCalls = 0
  await page.route('**/puzzles/index.json', (route) => {
    indexCalls += 1
    return indexCalls === 1 ? route.fulfill({ status: 503 }) : route.continue()
  })
  await page.route('**/eval/results.json', (route) => {
    evalCalls += 1
    return evalCalls === 1 ? route.fulfill({ status: 503 }) : route.continue()
  })
  await page.goto('/play')
  await expect(page.getByText("Couldn't load the games. Try again.")).toBeVisible()
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.tile')).toHaveCount(100)
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Home', exact: true }).click()
  await page.getByText('See the results', { exact: true }).click()
  const compare = page.getByRole('region', { name: 'How the judges compare' })
  await expect(compare.getByText("Couldn't load the answer-key results.")).toBeVisible()
  await compare.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(compare.locator('.compare__summary')).toContainText('81.4%')
  expect(indexCalls).toBe(2)
  expect(evalCalls).toBe(2)
})

test('a failed screen chunk leaves navigation and reload available', async ({ page }) => {
  await page.route('**/assets/LibraryScene-*.js', (route) => route.abort())
  await page.goto('/play')
  await expect(page.getByRole('alert')).toContainText("Couldn't load this part of the page.")
  await expect(page.getByRole('link', { name: 'Reload', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Three ways to play' })).toBeVisible()
})

test('Settings stays closeable while loading, restores focus, and preserves lazy Privacy anchors', async ({ page }) => {
  let release = () => {}
  const ready = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/assets/SettingsContents-*.js', async (route) => { await ready; await route.continue() })
  await page.goto('/')
  const settings = page.getByRole('button', { name: 'Settings', exact: true })
  await settings.click()
  const drawer = page.getByRole('dialog', { name: 'Settings', exact: true })
  await expect(drawer.getByRole('status')).toHaveText('Loading…')
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(settings).toBeFocused()
  release()
  await settings.click()
  await drawer.getByRole('link', { name: 'Privacy →', exact: true }).click()
  await expect(page).toHaveURL('/about#privacy')
  await expect(page.locator('#privacy')).toBeInViewport()
})

test('Library reuses its storage snapshot across filters, tabs and sheets; reset updates it', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('quibble:progress:oddly-specific:1', JSON.stringify({ best: 0 }))
    let reads = 0
    const proto = Object.getPrototypeOf(localStorage) as typeof localStorage
    // eslint-disable-next-line @typescript-eslint/unbound-method -- forwarded below with the original Storage receiver.
    const original = proto.getItem
    proto.getItem = function (key: string) {
      if (key.startsWith('quibble:progress:')) reads += 1
      return original.call(this, key)
    }
    Object.defineProperty(globalThis, '__progressReads', { get: () => reads })
  })
  await page.goto('/play')
  await expect(page.locator('.tile')).toHaveCount(100)
  expect(await page.evaluate<number>('globalThis.__progressReads')).toBe(256)
  await page.getByRole('button', { name: 'Hard', exact: true }).click()
  await page.getByRole('button', { name: /^G-02 Category Escape/u }).click()
  await page.getByRole('button', { name: /^G-01 Oddly Specific/u }).click()
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await page.locator('.tile').first().click()
  expect(await page.evaluate<number>('globalThis.__progressReads')).toBe(256)
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Reset this puzzle', exact: true }).click()
  await sheet.getByRole('button', { name: 'Press again to delete', exact: true }).click()
  await expect(page.locator('.tile').first()).toHaveClass('tile tile--unplayed')
  await expect(page.getByText('A good place to start.', { exact: true })).toBeVisible()
  expect(await page.evaluate<number>('globalThis.__progressReads')).toBe(512)
})

test('Library refreshes after another tab changes storage and Settings clears it', async ({ page, context }) => {
  await page.goto('/play')
  await expect(page.locator('.tile')).toHaveCount(100)
  const other = await context.newPage()
  await other.goto('/')
  await other.evaluate(() => { localStorage.setItem('quibble:progress:oddly-specific:1', JSON.stringify({ best: 0 })) })
  await expect(page.locator('.tile').first()).toHaveClass('tile tile--solved')
  await expect(page.getByText('Ready for another?', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Settings', exact: true })
  await drawer.getByRole('button', { name: 'Clear game data', exact: true }).click()
  await drawer.getByRole('button', { name: 'Press again to delete', exact: true }).click()
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.locator('.tile').first()).toHaveClass('tile tile--unplayed')
  await expect(page.getByText('A good place to start.', { exact: true })).toBeVisible()
  await other.close()
})

test('personal comparison totals refresh when Settings clears history', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('quibble:comparisons', JSON.stringify([{
      at: Date.now(), game: 'oddly-specific', n: 1, round: 'r1', answer: 'a',
      conditions: { c1: { cloud: 0.9, cloudPass: true, device: 0.8, devicePass: true } },
      cloudModel: 'clef-flash', cloudMs: 30, cloudModelMs: 20, deviceMs: 40,
      backend: 'webgpu', precision: 'q4', warm: true, referee: 'cloud', overruled: false,
    }]))
  })
  await page.goto('/')
  const compare = page.getByRole('region', { name: 'How the judges compare' })
  await compare.getByText('See the results', { exact: true }).click()
  await compare.getByRole('button', { name: 'Your games', exact: true }).click()
  await expect(compare).toContainText('1 guesses · saved in this browser')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Settings', exact: true })
  await drawer.getByRole('button', { name: 'Clear history', exact: true }).click()
  await drawer.getByRole('button', { name: 'Press again to delete', exact: true }).click()
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(compare.getByRole('heading', { name: 'No comparisons yet.' })).toBeVisible()
})
