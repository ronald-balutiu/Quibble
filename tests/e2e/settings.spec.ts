import { expect, test } from '@playwright/test'

// L3 on a device that can't run the on-device judge (5.5): CI's headless browser has
// no WebGPU adapter, so it never sees an offer.
test('the settings drawer opens from the header and shows the unsupported device state', async ({ page }) => {
  await page.goto('/play')
  await page.getByRole('button', { name: 'Settings' }).click()
  const drawer = page.getByRole('dialog', { name: 'Settings' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('radio', { name: 'Cloud', exact: true })).toBeChecked()
  await expect(drawer.getByRole('radio', { name: 'On-device', exact: true })).toBeDisabled()
  await expect(drawer.getByText('The on-device judge needs a desktop browser with WebGPU and enough memory.')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Turn on' })).toHaveCount(0)
  await drawer.getByRole('button', { name: 'Close' }).click()
  await expect(drawer).toBeHidden()

  // Nor does a game offer it.
  await page.goto('/play/oddly-specific/1')
  await expect(page.getByRole('button', { name: '○ Device • off' })).toHaveCount(0)
})

test('Home opens the same drawer, and Escape closes it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden()
})

test('the referee heading has the same top spacing as the other Settings groups', async ({ page }) => {
  await page.goto('/play')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Settings', exact: true })
  const legend = drawer.getByRole('group', { name: 'Referee • who decides', exact: true }).locator('legend')
  await legend.scrollIntoViewIfNeeded()
  const cloudGroup = await drawer.locator('.drawer__group').first().boundingBox()
  const heading = await legend.boundingBox()
  expect(heading!.y - cloudGroup!.y - cloudGroup!.height).toBeGreaterThanOrEqual(24)
  const choices = await drawer.locator('.drawer__choices').boundingBox()
  expect(choices!.y - heading!.y - heading!.height).toBeGreaterThanOrEqual(12)
})

test('Settings keeps its close button available and puts Privacy at the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 })
  await page.goto('/play')
  const settings = page.getByRole('button', { name: 'Settings', exact: true })
  await settings.click()
  const drawer = page.getByRole('dialog', { name: 'Settings', exact: true })
  await expect(drawer.locator('footer')).toHaveCount(0)
  await expect(drawer.getByText('No accounts • no tracking', { exact: true })).toHaveCount(0)
  const close = drawer.getByRole('button', { name: 'Close', exact: true })
  const header = drawer.locator('.drawer__header')
  const before = await header.boundingBox()
  const closeBox = await close.boundingBox()
  expect(closeBox!.width).toBeGreaterThanOrEqual(44)
  expect(closeBox!.height).toBeGreaterThanOrEqual(44)
  const cloud = drawer.getByRole('radio', { name: 'Cloud', exact: true })
  await cloud.scrollIntoViewIfNeeded()
  await expect(cloud).toBeInViewport()
  const clear = drawer.getByRole('button', { name: 'Clear game data', exact: true })
  await clear.scrollIntoViewIfNeeded()
  const rowText = await drawer.locator('.drawer__row').filter({ hasText: 'Game progress' }).locator(':scope > span').boundingBox()
  const clearBox = await clear.boundingBox()
  expect(clearBox!.y).toBeGreaterThanOrEqual(rowText!.y + rowText!.height)
  await drawer.getByRole('button', { name: 'Delete…', exact: true }).scrollIntoViewIfNeeded()
  await expect(close).toBeInViewport()
  const privacy = drawer.getByRole('link', { name: 'Privacy →', exact: true })
  await privacy.scrollIntoViewIfNeeded()
  await expect(privacy).toBeInViewport()
  expect((await header.boundingBox())!.y).toBe(before!.y)
  expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(320)
  expect(await page.evaluate<boolean>('document.querySelector(".drawer").scrollWidth <= document.querySelector(".drawer").clientWidth')).toBe(true)
  await close.click()
  await expect(settings).toBeFocused()
})

test('changing the cloud judge during a game applies to the next guess', async ({ page }) => {
  const models: string[] = []
  await page.route('**/api/judge', async (route) => {
    const body = route.request().postDataJSON() as { attempt: number, model: string }
    models.push(body.model)
    await route.fulfill({ status: 502, json: { attempt: body.attempt, error: 'unavailable' } })
  })
  await page.goto('/play/oddly-specific/1')
  await page.getByRole('textbox').fill('first guess')
  await page.getByRole('textbox').press('Enter')
  await expect(page.getByText('NOT JUDGED • NO STRIKE')).toBeVisible()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Settings' })
  await drawer.getByRole('radio', { name: 'Gemma 4', exact: true }).check()
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect.poll(() => models).toEqual(['clef-flash', 'gemma-4'])
  await expect(page.getByRole('img', { name: '0 of 3 wrong guesses used' })).toBeVisible()
})

for (const action of ['Clear game data', 'Delete…']) {
  test(`${action} during a game returns to Library without restoring deleted progress`, async ({ page }) => {
    await page.goto('/play/double-agent/1')
    await page.getByRole('button', { name: 'Skip round', exact: true }).click()
    await expect(page.getByText('Skipped', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Settings' })
    await drawer.getByRole('button', { name: action, exact: true }).click()
    await drawer.getByRole('button', { name: 'Press again to delete', exact: true }).click()
    await expect(page).toHaveURL('/play?game=double-agent')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^Start #001/u })).toBeVisible()
    await page.reload()
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('quibble:progress:')))).toEqual([])
  })
}

test('"Your data" counts what is saved, and each clear asks once more in place', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('quibble:progress:oddly-specific:1', JSON.stringify({ best: 9 }))
    localStorage.setItem('quibble:progress:oddly-specific:2', JSON.stringify({ run: { current: 0, rounds: [], finished: false } }))
    localStorage.setItem('quibble:comparisons', '[]')
    localStorage.setItem('quibble:settings:tipsSeen', 'oddly-specific')
  })
  await page.goto('/play')
  await page.getByRole('button', { name: 'Settings' }).click()
  const drawer = page.getByRole('dialog', { name: 'Settings' })
  await expect(drawer.getByText('2 puzzles · best scores and 1 unfinished run')).toBeVisible()
  await expect(drawer.getByText('0 comparisons · last 90 days')).toBeVisible()

  const clear = drawer.getByRole('button', { name: 'Clear game data' })
  await clear.click()
  await expect(drawer.getByRole('button', { name: 'Press again to delete' })).toBeVisible()
  await drawer.getByRole('button', { name: 'Press again to delete' }).click()
  await expect(drawer.getByRole('button', { name: 'Deleted' })).toBeDisabled()
  await expect(drawer.getByText('0 puzzles · best scores and 0 unfinished runs')).toBeVisible()

  await drawer.getByRole('button', { name: 'Delete…' }).click()
  await drawer.getByRole('button', { name: 'Press again to delete' }).click()
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('quibble:')))).toEqual([])
})
