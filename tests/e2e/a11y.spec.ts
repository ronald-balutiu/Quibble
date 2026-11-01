import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// The definition of done (0.2) for every screen in 5.5: axe-core reports no serious
// or critical issues, at both sizes. The API is mocked, so no model is called.

type Rounds = { rounds: { id: string, conditions: { id: string }[] }[] }
const puzzleOf = (game: string) => JSON.parse(readFileSync(`public/puzzles/${game}/1.json`, 'utf8')) as Rounds

async function mockApi(page: Page, reply: 'pass' | 'fail' | 'unavailable' | 'resting' = 'fail') {
  await page.route('**/api/judge', async (route) => {
    const body = route.request().postDataJSON() as { attempt: number, game: string, roundId: string }
    if (reply === 'unavailable') { await route.fulfill({ status: 502, json: { attempt: body.attempt, error: 'unavailable' } }); return }
    if (reply === 'resting') { await route.fulfill({ status: 503, json: { attempt: body.attempt, error: 'resting', resetAt: '2099-01-01T00:00:00.000Z' } }); return }
    const ids = puzzleOf(body.game).rounds.find((round) => round.id === body.roundId)?.conditions.map(({ id }) => id) ?? []
    await route.fulfill({ json: { attempt: body.attempt, model: 'clef-flash', modelMs: 40, conditions: Object.fromEntries(ids.map((id) => [id, { pass: reply === 'pass', p: reply === 'pass' ? 0.9 : 0.1 }])) } })
  })
  await page.route('**/api/reveal/**', (route) => route.fulfill({ json: { example: 'sock', also: ['sweater', 'jeans'] } }))
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

async function seed(page: Page, entries: Record<string, string>) {
  await page.addInitScript((values) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('quibble:settings:tipsSeen', 'oddly-specific,category-escape,double-agent')
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
  }, entries)
}

async function expectAccessible(page: Page, screen: string) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const serious = violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')
  expect(serious.map(({ id, nodes }) => `${screen}: ${id} (${nodes.map(({ target }) => target.join(' ')).join(', ')})`)).toEqual([])
}

async function guess(page: Page, answer: string) {
  const field = page.getByRole('textbox')
  await expect(field).toBeEnabled()
  await field.fill(answer)
  await field.press('Enter')
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
    await guess(page, 'bad one')
    await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
    await expectAccessible(page, 'G3')
    await page.unroute('**/api/judge')
    await mockApi(page, 'pass')
    await guess(page, 'good one')
    await expect(page.getByText(/^VERDICT • ACCEPTED/u)).toBeVisible()
    await expectAccessible(page, 'G4')

    await page.unroute('**/api/judge')
    await mockApi(page, 'unavailable')
    await page.keyboard.press('Enter')
    await guess(page, 'anything')
    await expect(page.getByText('NOT JUDGED • NO STRIKE')).toBeVisible()
    await expectAccessible(page, 'G7')
  })

  test('results screens (G6, E2, D2) and the cloud resting with the device off (S2)', async ({ page }) => {
    await seed(page, {
      'quibble:progress:oddly-specific:1': finished(5),
      'quibble:progress:category-escape:1': finished(6),
      'quibble:progress:double-agent:1': finished(puzzleOf('double-agent').rounds.length),
    })
    await mockApi(page, 'resting')
    for (const [game, screen] of [['oddly-specific', 'G6'], ['category-escape', 'E2'], ['double-agent', 'D2']] as const) {
      await page.goto(`/play/${game}/1`)
      await expect(page.getByRole('button', { name: 'Copy result' })).toBeVisible()
      await expectAccessible(page, screen)
    }
    await page.goto('/play/oddly-specific/2')
    await guess(page, 'anything')
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
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'gpu', { get: () => ({ requestAdapter: () => Promise.resolve({}) }) })
    })
    // Progress stops at 40% until the test lets it finish.
    await page.route('**/assets/worker-*.js', (route) => route.fulfill({
      contentType: 'text/javascript',
      body: `
        const total = 570483465
        self.onmessage = ({ data }) => {
          if (data.type === 'load') {
            self.postMessage({ type: 'progress', received: total * 0.4, total })
            setTimeout(() => { self.postMessage({ type: 'progress', received: total, total }); self.postMessage({ type: 'ready' }) }, 2500)
          }
          if (data.type === 'score') self.postMessage({ type: 'scored', id: data.id, scores: Object.fromEntries(data.claims.map((c) => [c.id, 0.9])) })
        }`,
    }))
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
    await guess(page, 'anything')
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
