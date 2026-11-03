import { expect, test } from '@playwright/test'
import { seedStorage } from './support'

test('first visit explains the games, then opens an unplayed tile directly', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Three ways to play' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'See how it works ↓' })).toHaveCount(0)
  await expect(page.locator('.welcome-game')).toHaveCount(3)
  await expect(page.getByText('No timer. Take your time.')).toHaveCount(0)
  await expect(page.getByText(/up to \d+ points/u)).toHaveCount(0)
  // Scoring is shown as example rounds; the tiles are decorative, so the rows read as text.
  await expect(page.getByRole('region', { name: 'How scoring works' })).toMatchAriaSnapshot(`
    - region "How scoring works":
      - heading "How scoring works" [level=2]
      - heading "Oddly Specific & Double Agent" [level=3]
      - list:
        - listitem:
          - text: First try
          - strong: "3"
          - text: points
        - listitem:
          - text: Second try
          - strong: "2"
          - text: points
        - listitem:
          - text: Third try
          - strong: "1"
          - text: point
        - listitem:
          - text: Round over
          - strong: "0"
          - text: points
      - heading "Category Escape" [level=3]
      - list:
        - listitem:
          - text: Each level cleared
          - strong: "1"
          - text: point
        - listitem: Three misses in the run Run over
      - paragraph: Judge wrong? Choose “Count it anyway” and keep your try.
      - paragraph: Play with both judges on, and over time you’ll see which one sees it your way.
  `)
  await expect(page.getByRole('heading', { name: 'How the judges compare' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pick your judges' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Ready to try one?' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Choose your cloud judge' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Add a local judge' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Choose a puzzle →', exact: true })).toHaveCount(1)
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

test('returning visits always open Home, including refreshes and navigation', async ({ page }) => {
  await seedStorage(page, { 'quibble:progress:oddly-specific:1': JSON.stringify({ best: 0 }) }, { everyLoad: true })
  await page.goto('/')
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Make your case.' })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Make your case.' })).toBeVisible()
  await page.getByRole('link', { name: 'Choose a puzzle →' }).first().click()
  await expect(page).toHaveURL('/play')
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Make your case.' })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Main', exact: true })
    .getByRole('link', { name: 'Library', exact: true })
    .click()
  await page.getByRole('link', { name: 'Quibble home', exact: true }).click()
  await expect(page).toHaveURL('/')
})

test('cloud selection in Home settings carries into the Library and survives refresh', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Settings' })
  await drawer.getByRole('radio', { name: /^Gemma 4/u }).check()
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('link', { name: 'Choose a puzzle →' }).first().click()
  await expect(page.getByRole('radio', { name: /^Gemma 4/u })).toBeChecked()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(drawer.getByRole('radio', { name: /^Gemma 4/u })).toBeChecked()
  await drawer.getByRole('radio', { name: /^Clef-flash/u }).check()
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(drawer.getByRole('radio', { name: /^Clef-flash/u })).toBeChecked()
})

test('welcome cards align on desktop and stay within a narrow phone', async ({ page, isMobile }) => {
  await page.goto('/')
  if (!isMobile) {
    const cards = await Promise.all(
      (await page.locator('.welcome-game').all()).map(async (el) => {
        const heading = await el.locator('h3').boundingBox()
        const example = await el.locator('.game-example').boundingBox()
        return { heading: heading?.y, example: example?.y, bottom: example && example.y + example.height }
      }),
    )
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
