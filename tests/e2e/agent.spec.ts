import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Plays a fixture Double Agent puzzle (3 rounds, D-64) against a mocked API. No
// Double Agent puzzles ship until Phase 4 closes (D-76), so the puzzle file is
// served from tests/fixtures. The intended words pass; "battery" fits only
// meaning B; anything else fits neither.

const fixture = readFileSync('tests/fixtures/puzzles/double-agent-1.json', 'utf8')
const puzzle = JSON.parse(fixture) as { rounds: { id: string, conditions: { id: string }[] }[] }
const words: Record<string, string> = { r1: 'charge', r2: 'bank', r3: 'bat' }

async function mockApi(page: Page) {
  await page.route('**/puzzles/double-agent/1.json', (route) => route.fulfill({ contentType: 'application/json', body: fixture }))
  await page.route('**/api/judge', async (route) => {
    const body = route.request().postDataJSON() as { attempt: number, answer: string, roundId: string }
    const [a, b] = puzzle.rounds.find((round) => round.id === body.roundId)?.conditions.map(({ id }) => id) ?? []
    const word = body.answer.toLowerCase()
    const fits = (side: 'a' | 'b') => word === words[body.roundId] || (word === 'battery' && side === 'b')
    await route.fulfill({
      json: {
        attempt: body.attempt, model: 'clef-flash', modelMs: 40,
        conditions: { [a ?? '']: fits('a') ? { pass: true, p: 0.9 } : { pass: false, p: 0.1 }, [b ?? '']: fits('b') ? { pass: true, p: 0.9 } : { pass: false, p: 0.1 } },
      },
    })
  })
  await page.route('**/api/reveal/**', (route) => {
    const roundId = route.request().url().split('/').at(-1) ?? ''
    return route.fulfill({ json: { example: words[roundId], also: [] } })
  })
}

async function guess(page: Page, answer: string) {
  await expect(page.getByRole('textbox')).toBeFocused()
  await page.keyboard.type(answer)
  await page.keyboard.press('Enter')
}

test('a whole Double Agent puzzle can be played with the keyboard alone', async ({ page }) => {
  await mockApi(page)
  await page.goto('/play/double-agent/1')

  // D1: both meanings, the one-time tip, and a single-word field.
  await expect(page.getByText('One word that means both.')).toBeVisible()
  await expect(page.getByText('MEANING A')).toBeVisible()
  await expect(page.getByText('Stored electrical energy')).toBeVisible()
  await expect(page.getByText('Rd 1 of 3')).toBeVisible()

  // Two words break a local rule: no strike.
  await guess(page, 'two words')
  await expect(page.getByText('One word, up to 20 letters.')).toBeVisible()
  await expect(page.getByRole('img', { name: '0 of 3 wrong guesses used' })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')

  // A wrong guess says which meaning it matched, and lands in B on the map.
  await guess(page, 'battery')
  await expect(page.getByText('battery fits B, not A.')).toBeVisible()
  await expect(page.getByRole('img', { name: /battery sits in B only/u }).first()).toBeAttached()

  // Typing the next guess moves on (one strike); solved on guess 2.
  await guess(page, 'charge')
  await expect(page.getByText('VERDICT • ACCEPTED • +2')).toBeVisible()
  await expect(page.getByText('Also fits both')).toBeVisible()
  await page.keyboard.press('Enter')

  await guess(page, 'bank')
  await expect(page.getByText('VERDICT • ACCEPTED • +3')).toBeVisible()
  await page.keyboard.press('Enter')

  // Round 3: a miss, then skip; the intended word is revealed.
  await guess(page, 'stick')
  await expect(page.getByText('It misses A and B.')).toBeVisible()
  await expect(async () => {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Skip round' })).toBeFocused({ timeout: 200 })
  }).toPass()
  await page.keyboard.press('Enter')
  await expect(page.getByText('ROUND 3 • NO POINTS')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'bat' })).toBeVisible()
  await page.keyboard.press('Enter')

  // D2: each round opens into its clues, guesses and example word.
  await expect(page.getByText('5/9')).toBeVisible()
  const review = page.getByRole('region', { name: 'What you got. What you missed.' })
  const rows = review.locator('.run-review__round')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('charge')
  await expect(rows.nth(0)).toContainText('2 pts')
  await rows.nth(0).locator('summary').click()
  await expect(rows.nth(0)).toContainText('Stored electrical energy')
  await expect(rows.nth(0)).toContainText('battery')
  await expect(rows.nth(0)).toContainText('Rejected by the judge')
  await rows.nth(2).locator('summary').click()
  await expect(rows.nth(2)).toContainText('bat')
  await expect(rows.nth(2)).toContainText('stick')
  await expect(rows.nth(2)).toContainText('Skipped')
})
