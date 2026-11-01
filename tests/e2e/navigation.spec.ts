import { expect, test } from '@playwright/test'

test('every page has the same navigation outside its content frame', async ({ page }) => {
  for (const [path, active] of [
    ['/?home=1', 'Home'],
    ['/play', 'Library'],
    ['/about', 'About'],
    ['/play/oddly-specific/1', 'Library'],
    ['/play/category-escape/1', 'Library'],
    ['/play/double-agent/1', 'Library'],
    ['/play/not-a-game/1', undefined],
    ['/not-a-page', undefined],
  ] as const) {
    await page.goto(path)
    const header = page.getByRole('banner')
    const nav = header.getByRole('navigation', { name: 'Main', exact: true })
    await expect(nav.getByRole('link')).toHaveText(['Home', 'Library', 'About'])
    await expect(header.getByRole('button', { name: 'Settings', exact: true })).toBeVisible()
    await expect(page.getByRole('main').locator('.site-header')).toHaveCount(0)
    const headerBox = await header.boundingBox()
    const mainBox = await page.getByRole('main').boundingBox()
    expect(headerBox).not.toBeNull()
    expect(mainBox).not.toBeNull()
    expect(headerBox!.y + headerBox!.height).toBeLessThan(mainBox!.y)
    if (active) {
      await expect(nav.locator('[aria-current="page"]')).toHaveText(active)
    }
    await header.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    await page.keyboard.press('Escape')
  }
})

test('game navigation returns to its Library tab and preserves a played round', async ({ page }) => {
  await page.goto('/play/double-agent/1')
  await page.getByRole('button', { name: 'Skip round', exact: true }).click()
  await expect(page.getByText('Skipped', { exact: true })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Main', exact: true })
  await nav.getByRole('link', { name: 'Library', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/play?game=double-agent')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Double Agent')
  await page.getByRole('link', { name: /^Continue #001/u }).click()
  await expect(page.getByText('Skipped', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Skipped', { exact: true })).toBeVisible()
  await nav.getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page).toHaveURL('/?home=1')
  await expect(page.getByRole('heading', { name: 'Make your case.' })).toBeVisible()
  await page.getByRole('link', { name: 'Quibble home', exact: true }).click()
  await expect(page).toHaveURL('/?home=1')
})

test('Privacy closes Settings on navigation, including when already on About', async ({ page }) => {
  for (const path of ['/play/category-escape/1', '/about', '/about#privacy']) {
    await page.goto(path)
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('link', { name: 'Privacy →' }).click()
    await expect(page).toHaveURL('/about#privacy')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Privacy', exact: true })).toBeInViewport()
  }
})

test('navigation remains available while a puzzle loads', async ({ page }) => {
  let release = () => {}
  const ready = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/puzzles/category-escape/1.json', async (route) => { await ready; await route.continue() })
  await page.goto('/play/category-escape/1', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Library' }).click()
  release()
  await expect(page).toHaveURL('/play?game=category-escape')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Category Escape')
})

test('the header fits a 320px phone with usable targets on every page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  for (const path of ['/?home=1', '/play', '/about', '/play/oddly-specific/1', '/play/category-escape/1', '/play/double-agent/1', '/not-a-page']) {
    await page.goto(path)
    const header = page.getByRole('banner')
    for (const control of await header.locator('a, button').all()) {
      await expect(control).toBeVisible()
      const box = await control.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(320)
    }
    expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(320)
  }
})
