import { expect, test } from '@playwright/test'

test('first visit explains the games, then opens an unplayed tile directly', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Three ways to play' })).toBeVisible()
  await expect(page.locator('.welcome-game')).toHaveCount(3)
  await expect(page.getByText('No timer. Take your time.')).toHaveCount(0)
  await expect(page.getByText(/up to \d+ points/u)).toHaveCount(0)
  const judges = page.getByRole('region', { name: 'Pick your judges' })
  await expect(judges).not.toContainText('Optional')
  await judges.getByText('Where do my answers go?').click()
  await expect(judges).toContainText('The model files come from Hugging Face.')
  await expect(judges).not.toContainText('IP address')
  await expect(page.getByText('© 2026 Ronald Balutiu. All rights reserved.')).toBeVisible()
  await page.getByRole('link', { name: 'Choose a puzzle →', exact: true }).first().click()
  await expect(page).toHaveURL('/play')
  await expect(page.getByRole('link', { name: /^Start #001/u })).toBeVisible()
  await page.getByRole('button', { name: /^001/u }).click()
  await expect(page).toHaveURL('/play/oddly-specific/1')
  await expect(page.getByRole('textbox')).toBeFocused()
  // A fresh saved run has no activity yet.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Make your case.' })).toBeVisible()
})

test('returning visits skip welcome, but Home opens and refreshes normally', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('quibble:progress:oddly-specific:1', JSON.stringify({ best: 0 }))
  })
  await page.goto('/')
  await expect(page).toHaveURL('/play')
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page).toHaveURL('/?home=1')
  await expect(page.getByRole('heading', { name: 'Make your case.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Make your case.' })).toBeVisible()
  await page.getByRole('link', { name: 'Choose a puzzle →' }).first().click()
  await expect(page).toHaveURL('/play')
})

test('the initial cloud choice is available in Library settings and survives refresh', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('radio', { name: /^Gemma 4/u }).check()
  await page.getByRole('link', { name: 'Choose a puzzle →' }).first().click()
  await page.getByRole('button', { name: 'Your data', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Settings' })
  await expect(drawer.getByRole('radio', { name: /^Gemma 4/u })).toBeChecked()
  await drawer.getByRole('radio', { name: /^Clef-flash/u }).check()
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page.getByRole('radio', { name: /^Clef-flash/u })).toBeChecked()
  await page.reload()
  await expect(page.getByRole('radio', { name: /^Clef-flash/u })).toBeChecked()
})

test('welcome cards align on desktop and stay within a narrow phone', async ({ page, isMobile }) => {
  await page.goto('/')
  if (!isMobile) {
    const cards = await Promise.all((await page.locator('.welcome-game').all()).map(async (el) => {
      const heading = await el.locator('h3').boundingBox()
      const example = await el.locator('.welcome-example').boundingBox()
      return { heading: heading?.y, example: example?.y, bottom: example && example.y + example.height }
    }))
    expect(new Set(cards.map((c) => c.heading)).size).toBe(1)
    expect(new Set(cards.map((c) => c.example)).size).toBe(1)
    expect(new Set(cards.map((c) => c.bottom)).size).toBe(1)
  } else {
    await page.setViewportSize({ width: 320, height: 800 })
    expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(320)
    await page.getByRole('link', { name: 'Choose a puzzle →' }).first().click()
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible()
    expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(320)
  }
})
