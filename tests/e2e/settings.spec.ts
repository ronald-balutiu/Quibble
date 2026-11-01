import { expect, test } from '@playwright/test'

// L3 on a device that can't run the on-device judge (5.5): CI's headless browser has
// no WebGPU adapter, so it never sees an offer.
test('the settings drawer opens from the header and shows the unsupported device state', async ({ page }) => {
  await page.goto('/play')
  await page.getByRole('button', { name: 'Your data' }).click()
  const drawer = page.getByRole('dialog', { name: 'Settings' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('radio', { name: '● Cloud' })).toBeChecked()
  await expect(drawer.getByRole('radio', { name: '○ On-device' })).toBeDisabled()
  await expect(drawer.getByText('Needs a desktop browser with WebGPU or enough memory.')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Turn on' })).toHaveCount(0)
  await drawer.getByRole('button', { name: 'Close' }).click()
  await expect(drawer).toBeHidden()

  // Nor does a game offer it.
  await page.goto('/play/oddly-specific/1')
  await expect(page.getByRole('button', { name: '○ Device • off' })).toHaveCount(0)
})

test('Home opens the same drawer, and Escape closes it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Your data' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden()
})

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
  await page.getByRole('button', { name: 'Your data' }).click()
  const drawer = page.getByRole('dialog', { name: 'Settings' })
  await expect(drawer.getByText('2 puzzles · best scores and 1 open run')).toBeVisible()
  await expect(drawer.getByText('0 comparisons · last 90 days')).toBeVisible()

  const clear = drawer.getByRole('button', { name: 'Clear game data' })
  await clear.click()
  await expect(drawer.getByRole('button', { name: 'Press again to delete' })).toBeVisible()
  await drawer.getByRole('button', { name: 'Press again to delete' }).click()
  await expect(drawer.getByRole('button', { name: 'Deleted' })).toBeDisabled()
  await expect(drawer.getByText('0 puzzles · best scores and 0 open runs')).toBeVisible()

  await drawer.getByRole('button', { name: 'Delete…' }).click()
  await drawer.getByRole('button', { name: 'Press again to delete' }).click()
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('quibble:')))).toEqual([])
})
