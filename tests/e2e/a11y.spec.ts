import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './accessibility'
import {
  allConditions,
  mockJudge,
  mockReveal,
  seedStorage,
  shippedPuzzle,
  stubDeviceJudge,
  submitGuess,
  tipsSeen,
} from './support'
import { gameConfigs, type GameId } from '../../shared/games'
import { escapeReducer, startEscape } from '../../src/games/category-escape/reducer'
import { runReducer, startRun } from '../../src/games/rounds/reducer'
import type { Guess } from '../../src/games/shared/run'

// The definition of done (0.2) for every screen in 5.5: axe-core reports no serious
// or critical issues, at both sizes. The API is mocked, so no model is called.

async function mockApi(page: Page, reply: 'pass' | 'fail' | 'unavailable' | 'resting' = 'fail') {
  await mockJudge(page, (request) => {
    if (reply === 'unavailable') return { status: 502, json: { attempt: request.attempt, error: 'unavailable' } }
    if (reply === 'resting')
      return { status: 503, json: { attempt: request.attempt, error: 'resting', resetAt: '2099-01-01T00:00:00.000Z' } }
    return allConditions(shippedPuzzle(request.game), request, reply === 'pass')
  })
  await mockReveal(page)
}

// A finished run, so a results screen loads directly.
function finished(game: GameId) {
  const guesses: Guess[] = ['apple', 'fork', 'spoon', 'mug', 'plate', 'bowl'].map((answer) => ({
    answer,
    pass: true,
    failed: [],
    closeCall: false,
  }))
  if (game === 'category-escape') {
    const config = gameConfigs[game]
    const reduce = escapeReducer(config)
    const run = guesses.reduce((state, guess) => reduce(state, { type: 'judged', guess }), startEscape(config))
    return JSON.stringify({ run })
  }
  const config = { ...gameConfigs[game], rounds: shippedPuzzle(game).rounds.length }
  const reduce = runReducer(config)
  let run = startRun(config)
  for (const guess of guesses.slice(0, config.rounds)) {
    run = reduce(run, { type: 'judged', guess })
    run = reduce(run, { type: 'nextRound' })
  }
  return JSON.stringify({ run })
}

const seed = (page: Page, entries: Record<string, string>) => seedStorage(page, { ...tipsSeen, ...entries })

test.describe('axe-core on every screen (0.2)', () => {
  test('Home (H1, H2, H3), Library (L1–L3), About (P1) and Not found (P2)', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Make your case.' })).toBeVisible()
    await expectAccessible(page, 'H2')
    await page.getByText('See the results', { exact: true }).click()
    await page.getByRole('button', { name: 'Hide detailed comparison' }).click()
    await page.getByRole('button', { name: 'Show the full comparison' }).click()
    await expect(page.getByRole('table', { name: 'Detailed answer-key results' })).toBeVisible()
    await expectAccessible(page, 'H3')

    await seed(page, { 'quibble:progress:oddly-specific:2': JSON.stringify({ best: 9 }) })
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'Make your case.' })).toBeVisible()
    await expectAccessible(page, 'H1')

    await page.goto('/play')
    await expect(page.getByRole('button', { name: /^2\b/u })).toBeVisible()
    await expectAccessible(page, 'L1')
    await page.getByRole('button', { name: /^2\b/u }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectAccessible(page, 'L2')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    await expectAccessible(page, 'L3')

    await page.goto('/about')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectAccessible(page, 'P1')
    await page.goto('/no-such-page')
    await expect(page.getByRole('main')).toHaveAttribute('data-scene', 'not-found')
    await expectAccessible(page, 'P2')
  })

  test('Oddly Specific: round start, rejected, solved, not judged and results (G1, G3, G4, G7, G6)', async ({
    page,
  }) => {
    await seed(page, {})
    await mockApi(page, 'fail')
    await page.goto('/play/oddly-specific/1')
    await expect(page.getByRole('textbox')).toBeFocused()
    await expectAccessible(page, 'G1')
    await submitGuess(page, 'bad one')
    await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
    await expectAccessible(page, 'G3')
    await page.unroute('**/api/judge')
    await mockApi(page, 'pass')
    await submitGuess(page, 'good one')
    await expect(page.getByText(/^VERDICT • ACCEPTED/u)).toBeVisible()
    await expectAccessible(page, 'G4')

    await page.unroute('**/api/judge')
    await mockApi(page, 'unavailable')
    await page.keyboard.press('Enter')
    await submitGuess(page, 'anything')
    await expect(page.getByText('NOT JUDGED • NO STRIKE')).toBeVisible()
    await expectAccessible(page, 'G7')
  })

  test('results screens (G6, E2, D2) and the cloud resting with the device off (S2)', async ({ page }) => {
    await seed(page, {
      'quibble:progress:oddly-specific:1': finished('oddly-specific'),
      'quibble:progress:category-escape:1': finished('category-escape'),
      'quibble:progress:double-agent:1': finished('double-agent'),
    })
    await mockApi(page, 'resting')
    for (const [game, screen] of [
      ['oddly-specific', 'G6'],
      ['category-escape', 'E2'],
      ['double-agent', 'D2'],
    ] as const) {
      await page.goto(`/play/${game}/1`)
      await expect(page.getByRole('button', { name: 'Copy result' })).toBeVisible()
      await expectAccessible(page, screen)
      const last = page.getByRole('region', { name: 'Your game' }).locator('.run-review__round').last()
      await last.locator(':scope > summary').click()
      await last.locator('.run-review__history > summary').click()
      await expect(last.getByRole('table', { name: 'Judge verdicts for your guesses, by rule' })).toBeVisible()
      await expectAccessible(page, `${screen} expanded review`)
    }
    await page.goto('/play/oddly-specific/2')
    await submitGuess(page, 'anything')
    await expect(page.getByText(/^The cloud judge is resting until /u)).toBeVisible()
    await expectAccessible(page, 'S2')
  })

  test('Category Escape and Double Agent rounds (E1, D1)', async ({ page }) => {
    await seed(page, {})
    await mockApi(page, 'fail')
    await page.goto('/play/category-escape/1')
    await expect(page.getByRole('textbox')).toBeFocused()
    await expectAccessible(page, 'E1')
    await page.goto('/play/double-agent/1')
    await expect(page.getByRole('textbox')).toBeFocused()
    await expectAccessible(page, 'D1')
  })

  test('the on-device judge: S3, S4 and S1 (stubbed worker)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The on-device judge is offered on desktop only.')
    await seed(page, {})
    // Progress stops at 40% for 2.5 s, long enough to check S4.
    await stubDeviceJudge(page, { pauseAt: 0.4, resumeAfterMs: 2500 })
    await mockApi(page, 'resting')
    await page.goto('/play/oddly-specific/1')
    await page.getByRole('button', { name: '○ Device • off' }).click()
    const offer = page.getByRole('dialog', { name: 'Add a judge that runs on this device' })
    await expect(offer).toBeVisible()
    await expectAccessible(page, 'S3')
    await offer.getByRole('button', { name: 'Download' }).click()
    const install = page.getByRole('dialog', { name: 'On-device judge' })
    await expect(install.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
    await expectAccessible(page, 'S4')
    await expect(install).toBeHidden({ timeout: 10_000 })
    await submitGuess(page, 'anything')
    await expect(page.getByText(/Not counted in the comparison\.$/u)).toBeVisible()
    await expectAccessible(page, 'S1')
  })
})

// 0.2: Home's ring mark, in characters, is a described image that turns, and holds
// its still frame under prefers-reduced-motion.
test('reduced motion keeps Home’s ring mark still', async ({ page }) => {
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const mark = page.getByRole('img', { name: /^Three overlapping rings drawn in letters/u })
  await expect(mark).toBeVisible()
  const still = await mark.textContent()
  await page.clock.runFor(500)
  expect(await mark.textContent()).toBe(still)

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect
    .poll(async () => {
      await page.clock.runFor(100)
      return mark.textContent()
    })
    .not.toBe(still)
})
