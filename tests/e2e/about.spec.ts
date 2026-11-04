import { expect, test } from '@playwright/test'

// P1: the case study, with the published answer-key results and the privacy note.
test('the about page walks through the games, the judges, the test and the puzzles with real results', async ({
  page,
}) => {
  await page.goto('/about')
  await expect(page).toHaveTitle('About · Quibble')
  await expect(page.getByRole('heading', { level: 1, name: 'Two judges, one question: does it fit?' })).toBeVisible()
  await expect(page.getByText('Word games where you can argue with the referee.')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'No answer list. Just rules.',
    'A round, start to finish',
    'Who sees it your way?',
    'How I tested the judges',
    'Where the puzzles come from',
    'What leaves your browser',
    '07 · Credits',
  ])

  // Every game has an example; Category Escape's climbs three levels.
  const escape = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Category Escape' }) })
  await expect(escape.getByRole('definition')).toHaveText(['→ laptop', '→ paper clip', '→ pencil'])

  // How to play: the scores come from the game config, the verdicts read as words.
  await expect(page.getByText("Close. Nobody buys scissors by the pack, so that's one of your 3 tries.")).toBeVisible()
  await expect(page.getByText('+2 points. First try earns 3, second 2, third 1.')).toBeVisible()
  await expect(page.getByText('C: no', { exact: true })).toBeAttached()

  const tally = page.getByRole('table', { name: 'Example tally' })
  await expect(tally.getByRole('row', { name: /rubber duck/u }).getByRole('cell')).toHaveText([
    'no',
    'yes',
    'counted it, overruled cloud',
  ])

  // The test, from public/eval/results.json.
  await expect(page.getByText(/^Before launch, each judge ruled on the same 146 guesses/u)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Kinds of guesses in the test' }).getByRole('listitem')).toHaveCount(9)
  await expect(page.getByRole('definition')).toContainText(['93.2%', '81.4%', '67.8%'])
  await expect(page.getByText(/Clef-flash said no to 28% of good answers, but let only 7.4%/u)).toBeVisible()
  await expect(page.getByText('1.9%', { exact: true })).toBeVisible()
  await expect(page.getByText('109 ms', { exact: true })).toBeVisible()

  const slice = page.getByRole('table', { name: 'A slice of the real table' })
  await expect(slice.getByRole('row', { name: /scissors/u }).getByRole('cell')).toHaveText(['yes', 'yes', 'no'])
  await expect(page.getByText(/Open English WordNet \(CC BY 4\.0\)/u)).toBeVisible()

  await expect(page.getByRole('link', { name: 'Source on GitHub →' })).toHaveAttribute(
    'href',
    'https://github.com/ronald-balutiu/Quibble',
  )
  await page.setViewportSize({ width: 320, height: 800 })
  expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(320)
})

test('the settings Privacy link reaches the privacy section', async ({ page }) => {
  await page.goto('/play')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('link', { name: 'Privacy →' }).click()
  await expect(page).toHaveURL(/\/about#privacy$/u)
  const privacy = page.getByRole('region', { name: 'What leaves your browser' })
  await expect(privacy).toBeInViewport()
  await expect(privacy.getByRole('heading', { level: 3 })).toHaveText(['Sent out', 'Kept here'])
})
