import { expect, test, type Page } from '@playwright/test'
import { deferred } from '../support/deferred'
import { allConditions, mockJudge, mockReveal, seedStorage, shippedPuzzle } from './support'
import { gameIds } from '../../shared/games'
import { oddlySpecificConfig } from '../../shared/games/oddly-specific'
import { runReducer, startRun } from '../../src/games/rounds/reducer'
import AxeBuilder from '@axe-core/playwright'

// Start at the final round's reveal to exercise the real results-to-puzzle
// navigation, without calling either model.
async function openResults(page: Page) {
  const reduce = runReducer(oddlySpecificConfig)
  let run = startRun(oddlySpecificConfig)
  for (let i = 0; i < oddlySpecificConfig.rounds; i++) {
    run = reduce(run, { type: 'skip' })
    if (i < oddlySpecificConfig.rounds - 1) run = reduce(run, { type: 'nextRound' })
  }
  await seedStorage(page, { 'quibble:progress:oddly-specific:1': JSON.stringify({ run }) }, { everyLoad: true })
  await mockReveal(page, () => ({ example: 'spoon', also: [] }))
  await page.goto('/play/oddly-specific/1')
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByText('0/15', { exact: true })).toBeVisible()
}

test('result details load examples on demand, support keyboard opening and retry failures', async ({ page, isMobile }) => {
  await openResults(page)
  if (isMobile) await page.setViewportSize({ width: 320, height: 800 })
  expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(page.viewportSize()!.width)
  const puzzle = shippedPuzzle('oddly-specific')
  let calls = 0
  await page.route(`**/api/reveal/oddly-specific/1/${puzzle.rounds[0]?.id ?? ''}`, (route) => {
    calls += 1
    return route.fulfill(calls === 1 ? { status: 503, body: '' } : { json: { example: 'spoon', also: ['fork'] } })
  })
  await expect(page.locator('.result-details')).not.toHaveAttribute('open')
  await expect(page.getByRole('table', { name: 'Detailed answer-key results' })).toHaveCount(0)
  const primary = await page.getByRole('link', { name: /^Next puzzle/u }).boundingBox()
  const review = page.getByRole('region', { name: 'Your game' })
  const reviewBox = await review.boundingBox()
  expect(primary!.y).toBeLessThan(reviewBox!.y)
  await page.getByText('Run details', { exact: true }).click()
  await expect(page.getByText('Guesses', { exact: true })).toBeVisible()
  await page.getByText('Compare the judges', { exact: true }).click()
  await expect(page.getByRole('table', { name: 'Detailed answer-key results' })).toBeVisible()
  const first = review.locator('.run-review__round').first()
  await expect(first).not.toHaveAttribute('open')
  const mutedColor = await page.evaluate<string>('getComputedStyle(document.querySelector(".result-summary .telemetry")).color')
  await expect(first.locator('.run-review__status')).toHaveCSS('color', mutedColor)
  expect(calls).toBe(0)
  await first.locator(':scope > summary').focus()
  await page.keyboard.press('Enter')
  await expect(first).toHaveAttribute('open')
  await expect(first).toContainText("Couldn't load the other answers.")
  await first.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(first.locator('.run-review__solution-word')).toHaveText('spoon')
  const rules = first.getByRole('list', { name: 'The rules', exact: true })
  const history = first.locator('.run-review__history')
  await expect(rules.getByRole('listitem')).toHaveCount(puzzle.rounds[0]?.conditions.length ?? 0)
  await expect(history).not.toHaveAttribute('open')
  await expect(first.getByText('fork', { exact: true })).not.toBeVisible()
  await history.locator(':scope > summary').focus()
  await page.keyboard.press('Enter')
  await expect(first.getByText('No guesses here.', { exact: true })).toBeVisible()
  const alternatives = first.getByRole('region', { name: 'Other answers', exact: true })
  await expect(alternatives.getByRole('listitem')).toHaveText(['fork'])
  expect(calls).toBe(2)
  const second = review.locator('.run-review__round').nth(1)
  await second.locator(':scope > summary').click()
  await expect(second).toHaveAttribute('open')
  await expect(first).not.toHaveAttribute('open')
  await first.locator(':scope > summary').click()
  await expect(second).not.toHaveAttribute('open')
  await expect(first.getByText('fork', { exact: true })).toBeVisible()
  expect(calls).toBe(2)
  expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(page.viewportSize()!.width)
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
})

for (const missing of [false, true]) {
  test(`next puzzle has its own loading and ${missing ? 'not-found' : 'game'} state`, async ({ page }) => {
    const puzzle = shippedPuzzle('oddly-specific', 2)
    const ready = deferred()
    await page.route('**/puzzles/oddly-specific/2.json', async (route) => {
      await ready.promise
      await route.fulfill(missing ? { status: 404, body: '' } : { json: puzzle })
    })
    try {
      await openResults(page)
      await page.getByRole('link', { name: /^Next puzzle #002/u }).click()
      await expect(page.getByText('Loading puzzle…', { exact: true })).toBeVisible()
      await expect(page.getByText('0/15', { exact: true })).toHaveCount(0)
    } finally {
      ready.resolve()
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
    const puzzle = shippedPuzzle(game)
    let calls = 0
    await mockJudge(page, (request) => {
      calls += 1
      return { ...allConditions(puzzle, request, false), modelMs: 1 }
    })
    await mockReveal(page, () => ({ example: 'spoon', also: [] }))
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
