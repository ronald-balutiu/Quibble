import { expect, test, type Page } from '@playwright/test'
import { conditionsOf, mockJudge, mockReveal, shippedPuzzle, tabToButton, typeGuess, type JudgeReply, type JudgeRequest } from './support'

// Plays the shipped Oddly Specific puzzle #1 against a mocked API, so no model
// calls or Turnstile tokens are needed. Answers starting with "good" pass every
// condition; anything else fails the first two.

const puzzle = shippedPuzzle('oddly-specific')

async function mockApi(page: Page, override?: (request: JudgeRequest) => JudgeReply) {
  await mockJudge(page, (request) => override?.(request) ?? {
    passes: Object.fromEntries(conditionsOf(puzzle, request.roundId).map((id, i) => [id, request.answer.toLowerCase().startsWith('good') || i > 1])),
  }, { delayMs: 300 })
  await mockReveal(page)
}

test('a whole Oddly Specific puzzle can be played with the keyboard alone', async ({ page }) => {
  await mockApi(page)
  await page.goto('/play/oddly-specific/1')
  const answer = page.getByRole('textbox')

  // G1: round start, with the one-time tip and the answer field focused.
  await expect(page.getByText(/Name one thing that fits all three/u)).toBeVisible()
  await expect(answer).toBeFocused()

  // G2 → G4: judging, then solved on guess 1.
  await typeGuess(page, 'good one')
  await expect(page.getByRole('button', { name: 'JUDGING' })).toBeVisible()
  await expect(page.getByText('VERDICT • ACCEPTED • +3')).toBeVisible()
  await expect(page.getByText('Also fits all three')).toBeVisible()
  await page.keyboard.press('Enter')

  // G3: rejected; typing the next guess moves on, then solved on guess 2.
  await expect(answer).toBeFocused()
  await typeGuess(page, 'bad one')
  await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
  await expect(page.getByText('It misses A and B.')).toBeVisible()
  await typeGuess(page, 'good two')
  await expect(page.getByText('VERDICT • ACCEPTED • +2')).toBeVisible()
  await page.keyboard.press('Enter')

  // G5 (skipped): tab to "Skip round".
  await expect(answer).toBeFocused()
  await tabToButton(page, 'Skip round')
  await expect(page.getByText('ROUND 3 • NO POINTS')).toBeVisible()
  await expect(page.getByText('Skipped')).toBeVisible()
  await page.keyboard.press('Enter')

  // G5 (lost): three rejections; the third strike lands on moving on.
  for (const attempt of ['bad a', 'bad b', 'bad c']) {
    await expect(answer).toBeFocused()
    await typeGuess(page, attempt)
    await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
  }
  await page.keyboard.type('x')
  await expect(page.getByText('ROUND 4 • NO POINTS')).toBeVisible()
  await expect(page.getByText('Your guesses')).toBeVisible()
  await page.keyboard.press('Enter')

  // G6: results after the last round.
  await typeGuess(page, 'good five')
  await expect(page.getByRole('button', { name: 'See results' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('FIRST PLAY')).toBeVisible()
  await expect(page.getByText('8/15')).toBeVisible()
  await expect(page.getByLabel('✓ 2 ✗ ✗ ✓')).toBeVisible()
  const review = page.getByRole('region', { name: 'What you got. What you missed.' })
  const rounds = review.locator('.run-review__round')
  await expect(rounds).toHaveCount(5)
  await rounds.nth(1).locator('summary').click()
  await expect(rounds.nth(1)).toContainText('bad one')
  await expect(rounds.nth(1)).toContainText('good two')
  await expect(rounds.nth(1)).toContainText('Rejected by the judge')
  await expect(rounds.nth(1)).toContainText('Accepted')
  await expect(rounds.nth(1)).toContainText('sock')
  await rounds.nth(2).locator('summary').click()
  await expect(rounds.nth(2)).toContainText('No guesses here.')
  await rounds.nth(3).locator('summary').click()
  await expect(rounds.nth(3).locator('.run-review__guesses > li')).toHaveCount(3)
})

test.describe('a guess the cloud judge could not decide (G7, S2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('quibble:settings:tipsSeen', 'oddly-specific') })
  })

  test('shows unreachable with Retry and no strike', async ({ page }) => {
    await mockApi(page, ({ attempt }) => ({ status: 502, json: { attempt, error: 'unavailable' } }))
    await page.goto('/play/oddly-specific/1')
    await typeGuess(page, 'anything')
    await expect(page.getByText('NOT JUDGED • NO STRIKE')).toBeVisible()
    await expect(page.getByText("The cloud judge isn't reachable right now. Your guess wasn't counted.")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    await expect(page.getByRole('img', { name: '0 of 3 wrong guesses used' })).toBeVisible()
  })

  test('shows offline when the browser has no connection', async ({ page, context }) => {
    await page.goto('/play/oddly-specific/1')
    await expect(page.getByRole('textbox')).toBeFocused()
    await context.setOffline(true)
    await typeGuess(page, 'anything')
    await expect(page.getByText("You're offline. Reconnect and retry.")).toBeVisible()
  })

  test('shows resting with the reset time when the daily allowance is used up', async ({ page }) => {
    await mockApi(page, ({ attempt }) => ({ status: 503, json: { attempt, error: 'resting', resetAt: '2026-10-30T00:00:00.000Z' } }))
    await page.goto('/play/oddly-specific/1')
    await typeGuess(page, 'anything')
    await expect(page.getByText(/^The cloud judge is resting until /u)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to library' }).last()).toBeVisible()
    // S2: the strip under the header, with the on-device judge off.
    const strip = page.getByRole('status', { name: 'The judges' })
    await expect(strip).toContainText('○ Cloud • resting')
    await expect(strip).toContainText('○ Device • off')
    await expect(page.getByRole('img', { name: '0 of 3 wrong guesses used' })).toBeVisible()
  })

  test('shows a timeout after 10 seconds', async ({ page }) => {
    test.slow()
    await mockApi(page, () => 'hang')
    await page.goto('/play/oddly-specific/1')
    await typeGuess(page, 'anything')
    await expect(page.getByText("The cloud judge didn't answer in 10 seconds.")).toBeVisible({ timeout: 15_000 })
  })
})
