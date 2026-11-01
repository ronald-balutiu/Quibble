import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('keeps headline accuracy visible and every test measure reachable', async ({ page }) => {
  await page.goto('/?home=1')
  const compare = page.getByRole('region', { name: 'How the judges compare' })
  const comparisonHeading = await compare.getByRole('heading', { name: 'How the judges compare' }).boundingBox()
  const gamesHeading = await page.getByRole('heading', { name: 'Three ways to play' }).boundingBox()
  expect(comparisonHeading!.x).toBe(gamesHeading!.x)
  await expect(compare).toContainText('where they tend to be too strict or too lenient')
  await expect(compare.locator('.compare__summary')).toContainText('81.4%')
  await expect(compare.locator('.compare__summary')).toContainText('96 of 118 answers')
  const table = compare.getByRole('table', { name: 'Detailed answer-key results' })
  for (const text of ['88.1%', '75.4%', '7.4%', '14.8%', '28.1%', '46.9%', '197 ms', '109 ms', '$0']) await expect(table).toContainText(text)
  await expect(table.getByRole('row', { name: /Confidence error/u })).toContainText('11')
  await compare.getByRole('button', { name: 'Hide detailed comparison' }).click()
  await expect(table).toBeHidden()
  await expect(compare.locator('.compare__summary')).toContainText('81.4%')
  await compare.getByRole('button', { name: 'Show the full comparison' }).click()
  await compare.getByText('About this test', { exact: true }).click()
  await expect(compare).toContainText('The other 28 had an unsure answer-key label')
  await expect(compare).toContainText('386 rules with known labels')
  await compare.locator('summary').filter({ hasText: 'Earlier development builds' }).click()
  await expect(compare).toContainText('83.1%')
  await expect(compare).toContainText('86.2%')
  await expect(compare).toContainText('Build 2 vs 1: +3.1 points')
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
})

test('follows the initial judge choice but previews another model without changing it', async ({ page }) => {
  await page.goto('/?home=1')
  const compare = page.getByRole('region', { name: 'How the judges compare' })
  await page.getByRole('radio', { name: /^Gemma 4/u }).check()
  await expect(compare.getByRole('combobox')).toHaveValue('gemma-4')
  await expect(compare.locator('.compare__summary')).toContainText('110 of 118 answers')
  await compare.getByRole('combobox').selectOption('clef-flash')
  await expect(compare.locator('.compare__summary')).toContainText('96 of 118 answers')
  expect(await page.evaluate(() => localStorage.getItem('quibble:settings:cloudModel'))).toBe('gemma-4')
  await compare.getByRole('combobox').selectOption('gemma-4')
  await expect(compare.getByRole('row', { name: /Wrong answers accepted/u })).toContainText('1.9%')
  await expect(compare.getByRole('row', { name: /Confidence error/u })).toContainText('5')
})

test('personal comparisons use saved data and preserve agreement, strictness, overrides and warm speed', async ({ page }) => {
  await page.addInitScript(() => {
    const sample = (pairs: [boolean, boolean][], cloudMs: number, deviceMs: number, warm = true, referee = 'cloud', overruled = false) => ({
      at: Date.now(), game: 'oddly-specific', n: 1, round: 'r1', answer: 'x',
      conditions: Object.fromEntries(pairs.map(([cloudPass, devicePass], i) => [`c${String(i)}`, { cloud: 0.5, cloudPass, device: 0.5, devicePass }])),
      cloudModel: 'clef-flash', cloudMs, cloudModelMs: cloudMs, deviceMs, backend: 'webgpu', precision: 'q4', warm, referee, overruled,
    })
    localStorage.setItem('quibble:comparisons', JSON.stringify([
      sample([[true, true], [true, true]], 30, 100),
      sample([[false, true], [true, true]], 40, 120, true, 'cloud', true),
      sample([[true, false], [false, true]], 50, 140, true, 'device', true),
      sample([[true, true]], 900, 900, false),
    ]))
  })
  await page.goto('/?home=1')
  const compare = page.getByRole('region', { name: 'How the judges compare' })
  await compare.getByRole('button', { name: 'Your games', exact: true }).click()
  await expect(compare).toContainText('4 guesses · saved in this browser')
  await expect(compare).toContainText('50.0%')
  await expect(compare).toContainText('57.1%')
  await expect(compare).toContainText('The cloud was stricter in 2 of 3 disagreements.')
  const table = compare.getByRole('table', { name: 'Your game comparisons' })
  await expect(table.getByRole('row', { name: /You overruled/u }).getByRole('cell')).toHaveText(['1', '1'])
  await expect(table.getByRole('row', { name: /Typical judging time/u }).getByRole('cell')).toHaveText(['40 ms', '120 ms'])
  await expect(compare).toContainText('Both judges can agree and still be wrong.')
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
})

test('empty personal history and unavailable test results remain usable', async ({ page }) => {
  await page.route('**/eval/results.json', (route) => route.fulfill({ status: 503, body: '' }))
  await page.goto('/?home=1')
  const compare = page.getByRole('region', { name: 'How the judges compare' })
  await expect(compare).toContainText("Couldn't load the answer-key results.")
  await compare.getByRole('button', { name: 'Your games', exact: true }).click()
  await expect(compare.getByRole('heading', { name: 'No comparisons yet.' })).toBeVisible()
  await compare.getByText('How to start comparing', { exact: true }).click()
  await expect(compare).toContainText('Turn on the local judge from Home or the Library')
})

test('the comparison fits at 320px and exposes loading while results arrive', async ({ page }) => {
  let release = () => {}
  const ready = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/eval/results.json', async (route) => { await ready; await route.continue() })
  await page.goto('/?home=1', { waitUntil: 'domcontentloaded' })
  const compare = page.getByRole('region', { name: 'How the judges compare' })
  await expect(compare.getByRole('status')).toHaveText('Loading test results…')
  release()
  await expect(compare.locator('.compare__summary')).toContainText('81.4%')
  await page.setViewportSize({ width: 320, height: 800 })
  expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(320)
  await compare.getByRole('button', { name: 'Your games', exact: true }).click()
  expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(320)
})
