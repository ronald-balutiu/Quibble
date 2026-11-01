import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { gameIds } from '../../shared/games'
import { oddlySpecificConfig } from '../../shared/games/oddly-specific'
import { puzzleSchema } from '../../shared/schemas/puzzle'
import { runReducer, startRun } from '../../src/games/rounds/reducer'

// Start at the final round's reveal to exercise the real results-to-puzzle
// navigation, without calling either model.
async function openResults(page: Page) {
  const reduce = runReducer(oddlySpecificConfig)
  let run = startRun(oddlySpecificConfig)
  for (let i = 0; i < oddlySpecificConfig.rounds; i++) {
    run = reduce(run, { type: 'skip' })
    if (i < oddlySpecificConfig.rounds - 1) run = reduce(run, { type: 'nextRound' })
  }
  await page.addInitScript((saved) => { localStorage.setItem('quibble:progress:oddly-specific:1', JSON.stringify({ run: saved })) }, run)
  await page.route('**/api/reveal/**', (route) => route.fulfill({ json: { example: 'spoon', also: [] } }))
  await page.goto('/play/oddly-specific/1')
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByText('0/15', { exact: true })).toBeVisible()
}

for (const missing of [false, true]) {
  test(`next puzzle has its own loading and ${missing ? 'not-found' : 'game'} state`, async ({ page }) => {
    const body = readFileSync('public/puzzles/oddly-specific/2.json', 'utf8')
    let release = () => undefined as void
    const ready = new Promise<void>((resolve) => { release = resolve })
    await page.route('**/puzzles/oddly-specific/2.json', async (route) => {
      await ready
      await route.fulfill(missing ? { status: 404, body: '' } : { contentType: 'application/json', body })
    })
    await openResults(page)
    await page.getByRole('link', { name: /^Next puzzle #002/u }).click()
    try {
      await expect(page.getByText('Loading puzzle…', { exact: true })).toBeVisible()
      await expect(page.getByText('0/15', { exact: true })).toHaveCount(0)
    } finally {
      release()
    }
    if (missing) {
      await expect(page.getByText("This puzzle doesn't exist.")).toBeVisible()
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    } else {
      await expect(page.getByRole('textbox')).toBeFocused()
      await expect(page.getByText('Rd 1 of 5')).toBeVisible()
    }
  })
}

test('copying results reports success only after the clipboard accepts them', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    let denied = true
    Object.defineProperty(navigator, 'clipboard', { value: {
      writeText: () => {
        if (denied) { denied = false; return Promise.reject(new Error('clipboard denied')) }
        return Promise.resolve()
      },
    } })
  })
  await openResults(page)
  await page.getByRole('button', { name: 'Copy result' }).click()
  await expect(page.getByText('Copied', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Copy result' }).click()
  await expect(page.getByText('Copied', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

for (const game of gameIds) {
  test(`${game} restores a pending rejection and allows overruling it after reload`, async ({ page }) => {
    const puzzle = puzzleSchema.parse(JSON.parse(readFileSync(`public/puzzles/${game}/1.json`, 'utf8')))
    let calls = 0
    await page.route('**/api/judge', (route) => {
      calls += 1
      return route.fulfill({ json: {
        attempt: calls, model: 'clef-flash', modelMs: 1,
        conditions: Object.fromEntries((puzzle.rounds[0]?.conditions ?? []).map(({ id }) => [id, { pass: false, p: 0.1 }])),
      } })
    })
    await page.route('**/api/reveal/**', (route) => route.fulfill({ json: { example: 'spoon', also: [] } }))
    await page.goto(`/play/${game}/1`)
    await page.getByRole('textbox').fill('spoon')
    await page.getByRole('button', { name: 'JUDGE', exact: true }).click()
    await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
    await page.reload()
    await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
    await expect(page.getByRole('img', { name: '0 of 3 wrong guesses used' })).toBeVisible()
    await page.getByRole('button', { name: 'Count it anyway' }).click()
    await expect(page.getByText('COUNTED • YOU OVERRULED')).toBeVisible()
    expect(calls).toBe(1)
  })
}
