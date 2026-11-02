import { expect, test, type Page } from '@playwright/test'
import { conditionsOf, mockJudge, mockReveal, readPuzzle, servePuzzle, tabToButton, typeGuess } from './support'

// Plays a fixture Category Escape puzzle against a mocked API, so the test doesn't
// depend on the shipped library. Answers starting with "good" pass every rule;
// anything else fails the level's newest rule.

const FIXTURE = 'tests/fixtures/puzzles/category-escape-1.json'
const puzzle = readPuzzle(FIXTURE)
const path = ['apple', 'wooden spoon', 'oven mitt', 'sponge', 'cork', 'cork stopper']

async function mockApi(page: Page) {
  await servePuzzle(page, 'category-escape', 1, FIXTURE)
  await mockJudge(page, ({ roundId, answer }) => {
    const ids = conditionsOf(puzzle, roundId)
    const good = answer.toLowerCase().startsWith('good')
    return { passes: Object.fromEntries(ids.map((id, i) => [id, good || i < ids.length - 1])) }
  })
  await mockReveal(page, (roundId) => ({ example: path[puzzle.rounds.findIndex((round) => round.id === roundId)] ?? 'apple', also: [], path }))
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
  await typeGuess(page, 'good apple')
  await expect(page.getByText('VERDICT • ACCEPTED • L-01 CLEARED')).toBeVisible()
  await expect(level(page, 'L-01')).toContainText('good apple')
  await expect(level(page, 'L-02')).toContainText('+ Not food')

  // A used answer is refused without a strike.
  await typeGuess(page, 'good apple')
  await expect(page.getByText('ALREADY USED ON L-01 • NO STRIKE')).toBeVisible()
  await expect(page.getByRole('img', { name: '0 of 3 wrong guesses used' })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')

  // A rejection costs a strike only when the player moves on.
  await typeGuess(page, 'banana')
  await expect(page.getByText('It is food.')).toBeVisible()
  await typeGuess(page, 'good toaster')
  await expect(page.getByRole('img', { name: '1 of 3 wrong guesses used' })).toBeVisible()
  await expect(level(page, 'L-02')).toContainText('good toaster')

  // "Count it anyway" clears the level with no strike.
  await typeGuess(page, 'kettle')
  await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
  await tabToButton(page, 'Count it anyway')
  await expect(page.getByText('COUNTED • YOU OVERRULED')).toBeVisible()
  await expect(level(page, 'L-03')).toContainText('kettle')

  // Two more wrong guesses end the run (E2), with the path revealed.
  await typeGuess(page, 'board')
  await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
  await typeGuess(page, 'rolling pin')
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
  await tabToButton(page, 'Try #001 again')
  await expect(page.getByRole('img', { name: '0 of 3 wrong guesses used' })).toBeVisible()
  for (const [i, thing] of ['one', 'two', 'three', 'four', 'five'].entries()) {
    await typeGuess(page, `good ${thing}`)
    await expect(page.getByText(`VERDICT • ACCEPTED • L-0${String(i + 1)} CLEARED`)).toBeVisible()
  }
  await typeGuess(page, 'good six')
  await expect(page.getByText('ESCAPED • 6/6')).toBeVisible()
  await expect(page.getByText('NEW BEST • PREVIOUS 3')).toBeVisible()

  // Give up ends a run at the levels cleared.
  await tabToButton(page, 'Try #001 again')
  await typeGuess(page, 'good first')
  await expect(answer).toBeFocused()
  await tabToButton(page, 'Give up')
  await expect(page.getByText('GAVE UP')).toBeVisible()
  await expect(page.getByText('BEST 6')).toBeVisible()
})
