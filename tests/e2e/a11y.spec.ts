import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { allConditions, mockJudge, mockReveal, seedStorage, shippedPuzzle, stubDeviceJudge, submitGuess, tipsSeen } from './support'

// The definition of done (0.2) for every screen in 5.5: axe-core reports no serious
// or critical issues, at both sizes. The API is mocked, so no model is called.

async function mockApi(page: Page, reply: 'pass' | 'fail' | 'unavailable' | 'resting' = 'fail') {
  await mockJudge(page, (request) => {
    if (reply === 'unavailable') return { status: 502, json: { attempt: request.attempt, error: 'unavailable' } }
    if (reply === 'resting') return { status: 503, json: { attempt: request.attempt, error: 'resting', resetAt: '2099-01-01T00:00:00.000Z' } }
    return allConditions(shippedPuzzle(request.game), request, reply === 'pass')
  })
  await mockReveal(page)
}

// A finished run, so a results screen loads directly.
function finished(rounds: number) {
  return JSON.stringify({
    run: {
      current: rounds - 1, finished: true,
      rounds: Array.from({ length: rounds }, () => ({ status: 'solved', guesses: [{ answer: 'pocket', pass: true, failed: [], closeCall: false }], strikes: 0, pending: false, overruled: false, points: 3 })),
    },
  })
}

const seed = (page: Page, entries: Record<string, string>) => seedStorage(page, { ...tipsSeen, ...entries })

async function expectAccessible(page: Page, screen: string) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const serious = violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')
  expect(serious.map(({ id, nodes }) => `${screen}: ${id} (${nodes.map(({ target }) => target.join(' ')).join(', ')})`)).toEqual([])
}

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
    await expect(page.getByRole('button', { name: /^002/u })).toBeVisible()
    await expectAccessible(page, 'L1')
    await page.getByRole('button', { name: /^002/u }).click()
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

  test('Oddly Specific: round start, rejected, solved, not judged and results (G1, G3, G4, G7, G6)', async ({ page }) => {
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
      'quibble:progress:oddly-specific:1': finished(5),
      'quibble:progress:category-escape:1': finished(6),
      'quibble:progress:double-agent:1': finished(shippedPuzzle('double-agent').rounds.length),
    })
    await mockApi(page, 'resting')
    for (const [game, screen] of [['oddly-specific', 'G6'], ['category-escape', 'E2'], ['double-agent', 'D2']] as const) {
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

// 0.2: under prefers-reduced-motion the ring mark's orbits and pulse stop.
test('reduced motion stops the ring mark', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const moving = page.locator('.ring-mark__orbit, .ring-mark__pulse')
  await expect(moving).toHaveCount(4)
  for (const node of await moving.all()) await expect(node).toHaveCSS('animation-name', 'none')
})
