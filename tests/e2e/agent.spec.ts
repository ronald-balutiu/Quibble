import { expect, test, type Page } from '@playwright/test'
import { conditionsOf, mockJudge, mockReveal, readPuzzle, servePuzzle, typeGuess } from './support'

// Plays a fixture Double Agent puzzle (3 rounds, D-64) against a mocked API, so the
// test doesn't depend on the shipped library. The intended words pass; "battery"
// fits only meaning B; anything else fits neither.

const FIXTURE = 'tests/fixtures/puzzles/double-agent-1.json'
const puzzle = readPuzzle(FIXTURE)
const words: Record<string, string> = { r1: 'charge', r2: 'bank', r3: 'bat' }

async function mockApi(page: Page) {
  await servePuzzle(page, 'double-agent', 1, FIXTURE)
  await mockJudge(page, ({ roundId, answer }) => {
    const [a = '', b = ''] = conditionsOf(puzzle, roundId)
    const word = answer.toLowerCase()
    const intended = word === words[roundId]
    return { passes: { [a]: intended, [b]: intended || word === 'battery' } }
  })
  await mockReveal(page, (roundId) => ({ example: words[roundId]!, also: [] }))
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
  await typeGuess(page, 'two words')
  await expect(page.getByText('One word, up to 20 letters.')).toBeVisible()
  await expect(page.getByRole('img', { name: '0 of 3 wrong guesses used' })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')

  // A wrong guess says which meaning it matched, and lands in B on the map.
  await typeGuess(page, 'battery')
  await expect(page.getByText('battery fits B, not A.')).toBeVisible()
  await expect(page.getByRole('img', { name: /battery sits in B only/u }).first()).toBeAttached()

  // Typing the next guess moves on (one strike); solved on guess 2.
  await typeGuess(page, 'charge')
  await expect(page.getByText('VERDICT • ACCEPTED • +2')).toBeVisible()
  await expect(page.getByText('Also fits both')).toBeVisible()
  await page.keyboard.press('Enter')

  await typeGuess(page, 'bank')
  await expect(page.getByText('VERDICT • ACCEPTED • +3')).toBeVisible()
  await page.keyboard.press('Enter')

  // Round 3: a miss, then skip; the intended word is revealed.
  await typeGuess(page, 'stick')
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
  const review = page.getByRole('region', { name: 'Your game' })
  const rows = review.locator('.run-review__round')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('charge')
  await expect(rows.nth(0)).toContainText('2 pts')
  await rows.nth(0).locator(':scope > summary').click()
  await expect(rows.nth(0)).toContainText('Stored electrical energy')
  await expect(rows.nth(0).getByRole('row', { name: /battery/u })).not.toBeVisible()
  await rows.nth(0).locator('.run-review__history > summary').click()
  const guesses = rows.nth(0).getByRole('table', { name: 'Judge verdicts for your guesses, by rule' })
  const rejected = guesses.getByRole('row', { name: /battery/u })
  await expect(rejected).toBeVisible()
  await expect(rejected.getByRole('img', { name: 'Judge rejected this rule', exact: true })).toHaveCount(1)
  await expect(rejected.getByRole('img', { name: 'Judge accepted this rule', exact: true })).toHaveCount(1)
  await expect(
    guesses.getByRole('row', { name: /charge/u }).getByRole('img', { name: 'Judge accepted this rule', exact: true }),
  ).toHaveCount(2)
  await rows.nth(2).locator(':scope > summary').click()
  await expect(rows.nth(2)).toContainText('bat')
  await rows.nth(2).locator('.run-review__history > summary').click()
  await expect(rows.nth(2).getByRole('row', { name: /^stick/u })).toBeVisible()
  await expect(rows.nth(2)).toContainText('Skipped')
})
