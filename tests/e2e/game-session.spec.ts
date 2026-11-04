import { expect, test, type Page } from '@playwright/test'
import { deferred } from '../support/deferred'
import {
  allConditions,
  boxOf,
  tipsSeen,
  mockJudge,
  mockReveal,
  seedStorage,
  shippedPuzzle,
  submitGuess,
  viewportWidth,
} from './support'
import { gameIds } from '../../shared/games'
import { oddlySpecificConfig } from '../../shared/games/oddly-specific'
import { runReducer, startRun } from '../../src/games/rounds/reducer'
import { expectAccessible } from './accessibility'

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

test('result details load examples on demand, support keyboard opening and retry failures', async ({
  page,
  isMobile,
}) => {
  await openResults(page)
  if (isMobile) await page.setViewportSize({ width: 320, height: 800 })
  expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(viewportWidth(page))
  const puzzle = shippedPuzzle('oddly-specific')
  let calls = 0
  await page.route(`**/api/reveal/oddly-specific/1/${puzzle.rounds[0]?.id ?? ''}`, (route) => {
    calls += 1
    return route.fulfill(calls === 1 ? { status: 503, body: '' } : { json: { example: 'spoon', also: ['fork'] } })
  })
  await expect(page.locator('.result-details')).not.toHaveAttribute('open')
  await expect(page.getByRole('table', { name: 'Detailed answer-key results' })).toHaveCount(0)
  const primary = await boxOf(page.getByRole('link', { name: /^Next puzzle/u }))
  const review = page.getByRole('region', { name: 'Your game' })
  const reviewBox = await boxOf(review)
  expect(primary.y).toBeLessThan(reviewBox.y)
  await page.getByText('Run details', { exact: true }).click()
  await expect(page.getByText('Guesses', { exact: true })).toBeVisible()
  await page.getByText('Compare the judges', { exact: true }).click()
  await expect(page.getByRole('table', { name: 'Detailed answer-key results' })).toBeVisible()
  const first = review.locator('.run-review__round').first()
  await expect(first).not.toHaveAttribute('open')
  const mutedColor = await page.evaluate<string>(
    'getComputedStyle(document.querySelector(".result-summary .telemetry")).color',
  )
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
  expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(viewportWidth(page))
  await expectAccessible(page)
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
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => {
          if (denied) {
            denied = false
            return Promise.reject(new Error('clipboard denied'))
          }
          return Promise.resolve()
        },
      },
    })
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

// The judges' score axes draw their marks as layers that reach past the track, so a
// round screen could scroll sideways. No game may, before or after a verdict, at the
// project's own size or, on phones, at 320px.
for (const game of gameIds) {
  test(`${game} never scrolls sideways, before or after a verdict`, async ({ page, isMobile }) => {
    const puzzle = shippedPuzzle(game)
    await seedStorage(page, tipsSeen)
    await mockJudge(page, (request) => allConditions(puzzle, request, false))
    await page.goto(`/play/${game}/1`)
    const fitsWidth = async () => {
      expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(
        viewportWidth(page),
      )
    }
    for (const width of isMobile ? [undefined, 320] : [undefined]) {
      if (width) await page.setViewportSize({ width, height: 800 })
      await expect(page.getByRole('textbox')).toBeEnabled()
      await fitsWidth()
    }
    await submitGuess(page, 'spoon')
    await expect(page.locator('.axis__dot').first()).toBeAttached()
    await fitsWidth()
  })
}

for (const game of gameIds) {
  test(`${game} redisplays an old rejection without offering an overrule or spending another try`, async ({ page }) => {
    const puzzle = shippedPuzzle(game)
    let calls = 0
    await seedStorage(page, tipsSeen)
    await mockJudge(page, (request) => {
      calls += 1
      return allConditions(puzzle, request, false)
    })
    await page.goto(`/play/${game}/1`)
    await submitGuess(page, 'spoon')
    await expect(page.getByRole('button', { name: 'Count it anyway' })).toBeVisible()
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await submitGuess(page, 'spoon')
    await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Count it anyway' })).toHaveCount(0)
    await expect(page.getByRole('img', { name: '1 of 3 wrong guesses used' })).toBeVisible()
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(page.getByRole('textbox')).toBeEnabled()
    await expect(page.getByRole('img', { name: '1 of 3 wrong guesses used' })).toBeVisible()
    expect(calls).toBe(1)
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? '{}') as { run: { rounds: { overruled: boolean }[] } },
      `quibble:progress:${game}:1`,
    )
    expect(saved.run.rounds.some((round) => round.overruled)).toBe(false)
  })

  test(`${game} recovers an unusable saved run and preserves its best score`, async ({ page }) => {
    await seedStorage(page, {
      ...tipsSeen,
      [`quibble:progress:${game}:1`]: JSON.stringify({ best: 1, run: { current: 99, rounds: [], finished: false } }),
    })
    await page.goto(`/play/${game}/1`)
    await expect(page.getByRole('textbox')).toBeEnabled()
    const saved = await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key) ?? '{}') as { best: number; run: { current: number; rounds: unknown[] } },
      `quibble:progress:${game}:1`,
    )
    expect(saved.best).toBe(1)
    expect(saved.run.current).toBe(0)
    expect(saved.run.rounds).toHaveLength(shippedPuzzle(game).rounds.length)
  })
}

for (const stalled of ['widget', 'session request'] as const) {
  test(`a stalled ${stalled} during renewal times out and unlocks the game`, async ({ page }) => {
    const release = deferred()
    let judgeCalls = 0
    await mockJudge(page, () => {
      judgeCalls += 1
      return { status: 401, json: { error: 'session' } }
    })
    await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `
      globalThis.__removedWidgets = 0;
      window.turnstile = {
        render: (_container, options) => { window.__callbacks = options; return 'test-widget' },
        execute: () => { ${stalled === 'session request' ? "window.__callbacks.callback('test-token')" : ''} },
        remove: () => { globalThis.__removedWidgets += 1 }
      };
    `,
      }),
    )
    await page.route('**/api/session', async (route) => {
      await release.promise
      await route.fulfill({ status: 502, json: { error: 'unavailable' } })
    })
    try {
      await page.goto('/play/oddly-specific/1')
      await submitGuess(page, 'spoon')
      await expect(page.getByRole('textbox')).toBeDisabled()
      await expect(page.getByText('NOT JUDGED • NO STRIKE')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('textbox')).toBeEnabled()
      await expect(page.getByRole('img', { name: '0 of 3 wrong guesses used' })).toBeVisible()
      expect(await page.evaluate<number>('globalThis.__removedWidgets')).toBe(1)
      expect(judgeCalls).toBe(1)
    } finally {
      release.resolve()
    }
  })
}
