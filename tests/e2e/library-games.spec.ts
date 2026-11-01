import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

// The Library with Category Escape listed (it doesn't ship until Phase 4 closes,
// D-76, so the index is mocked): progress counts levels (D-78), and 6/6 is perfect.

const level = { status: 'playing', guesses: [], strikes: 0, pending: false, overruled: false, points: 0 }
const cleared = { ...level, status: 'solved', guesses: [{ answer: 'a', pass: true, failed: [], closeCall: false }], points: 1 }

test('Library cloud and local judges share a card style and cloud choice persists', async ({ page }) => {
  await page.goto('/play')
  const cloud = page.getByRole('region', { name: 'Choose your cloud judge', exact: true })
  await expect(cloud).toHaveCSS('border-top-width', '1px')
  const localPadding = await page.evaluate<string>('getComputedStyle(document.querySelector(".local-model")).paddingTop')
  await expect(cloud).toHaveCSS('padding-top', localPadding)
  await cloud.getByRole('radio', { name: 'Gemma 4', exact: true }).check()
  await page.reload()
  await expect(cloud.getByRole('radio', { name: 'Gemma 4', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' }).getByRole('radio', { name: 'Gemma 4', exact: true })).toBeChecked()
})

test('a completed puzzle changes the prompt across games, including a zero score', async ({ page }) => {
  await page.goto('/play')
  await expect(page.getByText('A good place to start.', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: /^Start #001/u }).click()
  for (let round = 1; round <= 5; round += 1) {
    await page.getByRole('button', { name: 'Skip round', exact: true }).click()
    await page.getByRole('button', { name: round === 5 ? 'See results' : `Round ${String(round + 1)} of 5`, exact: true }).click()
  }
  await expect(page.getByText('0/15', { exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Library', exact: true }).click()
  await expect(page.getByText('Ready for another?', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Start #002/u })).toBeVisible()
  await page.getByRole('button', { name: /^G-02 Category Escape/u }).click()
  await expect(page.getByText('Ready for another?', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Ready for another?', { exact: true })).toBeVisible()
  await expect(page.getByText('A good place to start.', { exact: true })).toHaveCount(0)
})

test('an unfinished puzzle keeps the resume prompt without counting as completed', async ({ page }) => {
  await page.goto('/play/oddly-specific/1')
  await page.getByRole('button', { name: 'Skip round', exact: true }).click()
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Library', exact: true }).click()
  await expect(page.getByText('Pick up where you left off.', { exact: true })).toBeVisible()
  await expect(page.getByText('Ready for another?', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^G-02 Category Escape/u }).click()
  await expect(page.getByText('A good place to start.', { exact: true })).toBeVisible()
})

test('the selected game colors its sidebar, description and supporting text', async ({ page }) => {
  await page.goto('/play')
  const rows = page.getByRole('navigation', { name: 'Games', exact: true })
  const colors = new Set<string>()
  for (const game of ['oddly-specific', 'category-escape', 'double-agent']) {
    const row = rows.locator(`[data-game="${game}"]`)
    await row.click()
    await expect(row).toHaveAttribute('aria-current', 'page')
    const accent = await page.evaluate<string>('getComputedStyle(document.querySelector(".game-row[aria-current]")).color')
    colors.add(accent)
    await expect(row).toHaveCSS('border-left-color', accent)
    await expect(row.locator('.game-row__tagline')).toHaveCSS('color', accent)
    await expect(row.locator('.telemetry').first()).toHaveCSS('color', accent)
    await expect(page.locator('.library__title')).toHaveCSS('color', accent)
    await expect(page.locator('.library-start p')).toHaveCSS('color', accent)
    for (const inactive of await rows.locator('.game-row:not([aria-current])').all()) {
      await expect(inactive).not.toHaveCSS('color', accent)
    }
  }
  expect(colors.size).toBe(3)
})

test('Category Escape progress reads in levels, and 6/6 is perfect', async ({ page }) => {
  await page.route('**/puzzles/index.json', (route) => route.fulfill({ json: { 'category-escape': [{ n: 1, difficulty: 'easy' }, { n: 2, difficulty: 'easy' }] } }))
  await page.addInitScript(({ open, perfect }) => {
    localStorage.setItem('quibble:progress:category-escape:1', open)
    localStorage.setItem('quibble:progress:category-escape:2', perfect)
  }, {
    open: JSON.stringify({ run: { current: 2, rounds: [cleared, cleared, level, level, level, level], finished: false } }),
    perfect: JSON.stringify({ best: 6 }),
  })
  await page.goto('/play?game=category-escape')

  await expect(page.getByRole('link', { name: 'Continue #001 · level 3' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^002.*, easy, perfect$/u })).toBeVisible()
  await page.getByRole('button', { name: /^001.*, easy, in progress$/u }).click()
  await expect(page.getByRole('button', { name: 'Resume level 3' })).toBeVisible()
})

// Phase 4 is done when all three games are playable from the Library with the full
// library: each game's first shipped puzzle opens from its tile.
for (const game of ['oddly-specific', 'category-escape', 'double-agent'] as const) {
  test(`${game} #001 opens from the Library`, async ({ page }) => {
    const puzzle = JSON.parse(readFileSync(`public/puzzles/${game}/1.json`, 'utf8')) as { rounds: { conditions: { label: string }[] }[] }
    await page.goto(`/play?game=${game}`)
    await page.getByRole('button', { name: /^001/u }).click()
    await expect(page).toHaveURL(`/play/${game}/1`)
    await expect(page.getByText(puzzle.rounds[0]?.conditions[0]?.label ?? '', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('textbox')).toBeFocused()
  })
}
