import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Plays a fixture Category Escape puzzle against a mocked API. No Category Escape
// puzzles ship until Phase 4 closes (D-76), so the puzzle file is served from
// tests/fixtures. Answers starting with "good" pass every rule; anything else
// fails the level's newest rule.

const fixture = readFileSync('tests/fixtures/puzzles/category-escape-1.json', 'utf8')
const puzzle = JSON.parse(fixture) as { rounds: { id: string, conditions: { id: string }[] }[] }
const path = ['apple', 'wooden spoon', 'oven mitt', 'sponge', 'cork', 'cork stopper']

async function mockApi(page: Page) {
  await page.route('**/puzzles/category-escape/1.json', (route) => route.fulfill({ contentType: 'application/json', body: fixture }))
  await page.route('**/api/judge', async (route) => {
    const body = route.request().postDataJSON() as { attempt: number, answer: string, roundId: string }
    const ids = puzzle.rounds.find((round) => round.id === body.roundId)?.conditions.map(({ id }) => id) ?? []
    const good = body.answer.toLowerCase().startsWith('good')
    await route.fulfill({
      json: {
        attempt: body.attempt, model: 'clef-flash', modelMs: 40,
        conditions: Object.fromEntries(ids.map((id, i) => [id, good || i < ids.length - 1 ? { pass: true, p: 0.9 } : { pass: false, p: 0.1 }])),
      },
    })
  })
  await page.route('**/api/reveal/**', (route) => {
    const id = route.request().url().split('/').at(-1)
    const i = puzzle.rounds.findIndex((round) => round.id === id)
    return route.fulfill({ json: { example: path[i] ?? 'apple', also: [], path } })
  })
}

async function guess(page: Page, answer: string) {
  await expect(page.getByRole('textbox')).toBeFocused()
  await page.keyboard.type(answer)
  await page.keyboard.press('Enter')
}

async function tabTo(page: Page, name: string) {
  await expect(async () => {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name })).toBeFocused({ timeout: 200 })
  }).toPass()
  await page.keyboard.press('Enter')
}

const level = (page: Page, code: string) => page.getByRole('list', { name: 'Levels, top is the last' }).getByRole('listitem').filter({ hasText: code })

test('a whole Category Escape run can be played with the keyboard alone', async ({ page }) => {
  await mockApi(page)
  await page.goto('/play/category-escape/1')
  const answer = page.getByRole('textbox')

  // E1: the category, the one-time tip, and later rules hidden.
  await expect(page.getByRole('heading', { name: 'In a kitchen' })).toBeVisible()
  await expect(page.getByText(/Each level adds a rule/u)).toBeVisible()
  await expect(level(page, 'L-02')).toContainText('Hidden')

  // Clearing a level moves straight on and reveals the next rule.
  await guess(page, 'good apple')
  await expect(page.getByText('VERDICT • ACCEPTED • L-01 CLEARED')).toBeVisible()
  await expect(level(page, 'L-01')).toContainText('good apple')
  await expect(level(page, 'L-02')).toContainText('+ Not food')

  // A used answer is refused without a strike.
  await guess(page, 'good apple')
  await expect(page.getByText('ALREADY USED ON L-01 • NO STRIKE')).toBeVisible()
  await expect(page.getByRole('img', { name: '0 of 3 wrong guesses used' })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')

  // A rejection costs a strike only when the player moves on.
  await guess(page, 'banana')
  await expect(page.getByText('It is food.')).toBeVisible()
  await guess(page, 'good toaster')
  await expect(page.getByRole('img', { name: '1 of 3 wrong guesses used' })).toBeVisible()
  await expect(level(page, 'L-02')).toContainText('good toaster')

  // "Count it anyway" clears the level with no strike.
  await guess(page, 'kettle')
  await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
  await tabTo(page, 'Count it anyway')
  await expect(page.getByText('COUNTED • YOU OVERRULED')).toBeVisible()
  await expect(level(page, 'L-03')).toContainText('kettle')

  // Two more wrong guesses end the run (E2), with the path revealed.
  await guess(page, 'board')
  await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
  await guess(page, 'rolling pin')
  await expect(page.getByRole('img', { name: '2 of 3 wrong guesses used' })).toBeVisible()
  await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
  await page.keyboard.type('x')
  await expect(page.getByText('RUN OVER • 3 WRONG GUESSES')).toBeVisible()
  await expect(page.getByText('/6 cleared')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'cork stopper' })).toBeVisible()
  await expect(page.getByText('Your 3 wrong guesses')).toBeVisible()
  await expect(page.getByText('L-02 • is food')).toBeVisible()
  await expect(page.getByRole('link', { name: /^Next puzzle #002/u })).toBeFocused()

  const review = page.getByRole('region', { name: 'What you got. What you missed.' })
  const levels = review.locator('.run-review__round')
  await expect(levels).toHaveCount(6)
  await levels.nth(2).locator('summary').click()
  await expect(levels.nth(2)).toContainText('kettle')
  await expect(levels.nth(2).locator('.run-review__guesses')).toContainText('Counted by you')
  await levels.nth(5).locator('summary').click()
  await expect(levels.nth(5)).toContainText('Not reached')
  await expect(levels.nth(5)).toContainText('You didn’t reach this level.')
  await expect(levels.nth(5)).toContainText('cork stopper')

  // Try again starts a fresh run; clearing all six levels escapes.
  // The next puzzle is the primary action; Try again is one Tab away.
  await page.getByRole('link', { name: /^Next puzzle #002/u }).focus()
  await tabTo(page, 'Try #001 again')
  await expect(page.getByRole('img', { name: '0 of 3 wrong guesses used' })).toBeVisible()
  for (const [i, thing] of ['one', 'two', 'three', 'four', 'five'].entries()) {
    await guess(page, `good ${thing}`)
    await expect(page.getByText(`VERDICT • ACCEPTED • L-0${String(i + 1)} CLEARED`)).toBeVisible()
  }
  await guess(page, 'good six')
  await expect(page.getByText('ESCAPED • 6/6')).toBeVisible()
  await expect(page.getByText('NEW BEST • PREVIOUS 3')).toBeVisible()

  // Give up ends a run at the levels cleared.
  await tabTo(page, 'Try #001 again')
  await guess(page, 'good first')
  await expect(answer).toBeFocused()
  await tabTo(page, 'Give up')
  await expect(page.getByText('GAVE UP')).toBeVisible()
  await expect(page.getByText('BEST 6')).toBeVisible()
})
