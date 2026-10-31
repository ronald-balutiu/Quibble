import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

// The Library with Category Escape listed (it doesn't ship until Phase 4 closes,
// D-76, so the index is mocked): progress counts levels (D-78), and 6/6 is perfect.

const level = { status: 'playing', guesses: [], strikes: 0, pending: false, overruled: false, points: 0 }
const cleared = { ...level, status: 'solved', guesses: [{ answer: 'a', pass: true, failed: [], closeCall: false }], points: 1 }

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
  await expect(page.getByRole('button', { name: 'Puzzle 2, easy, perfect' })).toBeVisible()
  await page.getByRole('button', { name: 'Puzzle 1, easy, in progress' }).click()
  await expect(page.getByRole('button', { name: 'Resume level 3' })).toBeVisible()
})

// Phase 4 is done when all three games are playable from the Library with the full
// library: each game's first shipped puzzle opens from its tile.
for (const game of ['oddly-specific', 'category-escape', 'double-agent'] as const) {
  test(`${game} #001 opens from the Library`, async ({ page }) => {
    const puzzle = JSON.parse(readFileSync(`public/puzzles/${game}/1.json`, 'utf8')) as { rounds: { conditions: { label: string }[] }[] }
    await page.goto(`/play?game=${game}`)
    await page.getByRole('button', { name: /^Puzzle 1, / }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page).toHaveURL(`/play/${game}/1`)
    await expect(page.getByText(puzzle.rounds[0]?.conditions[0]?.label ?? '', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('textbox')).toBeFocused()
  })
}
