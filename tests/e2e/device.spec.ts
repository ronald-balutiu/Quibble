import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// The on-device judge with a stubbed worker (Phase 5): CI's browser has no WebGPU,
// so the page sees a fake adapter and the built worker is swapped for a script that
// speaks the same protocol (src/judges/device/protocol.ts). The real model's parity
// run is local-only: tests/e2e/device-parity.local.ts.

const puzzle = JSON.parse(readFileSync('public/puzzles/oddly-specific/1.json', 'utf8')) as { rounds: { id: string, conditions: { id: string }[] }[] }

// `hang`: the download stops at 40% until cancelled. Answers starting with "good"
// score 0.9 on every claim, anything else 0.2.
function fakeWorker(mode: 'ready' | 'hang') {
  return `
    const total = 570483465
    let timer
    self.onmessage = ({ data }) => {
      if (data.type === 'load') {
        let received = 0
        self.postMessage({ type: 'progress', received, total })
        timer = setInterval(() => {
          received = Math.min(total, received + total / 10)
          self.postMessage({ type: 'progress', received, total })
          if (${JSON.stringify(mode)} === 'hang' && received >= total * 0.4) { clearInterval(timer); return }
          if (received >= total) {
            clearInterval(timer)
            self.postMessage({ type: 'warming' })
            setTimeout(() => self.postMessage({ type: 'ready' }), 300)
          }
        }, 80)
      }
      if (data.type === 'cancel') { clearInterval(timer); self.postMessage({ type: 'cancelled' }) }
      if (data.type === 'delete') { clearInterval(timer); self.postMessage({ type: 'deleted' }) }
      if (data.type === 'score') {
        const p = data.answer.startsWith('good') ? 0.9 : 0.2
        setTimeout(() => self.postMessage({ type: 'scored', id: data.id, scores: Object.fromEntries(data.claims.map((c) => [c.id, p])) }), 50)
      }
    }
  `
}

async function setUp(page: Page, mode: 'ready' | 'hang', cloud: 'judge' | 'resting' = 'judge') {
  await page.addInitScript(() => {
    localStorage.setItem('quibble:settings:tipsSeen', 'oddly-specific')
    Object.defineProperty(Navigator.prototype, 'gpu', { get: () => ({ requestAdapter: () => Promise.resolve({}) }) })
  })
  await page.route('**/assets/worker-*.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fakeWorker(mode) }))
  await page.route('**/api/judge', async (route) => {
    const body = route.request().postDataJSON() as { attempt: number, answer: string, roundId: string }
    if (cloud === 'resting') {
      await route.fulfill({ status: 503, json: { attempt: body.attempt, error: 'resting', resetAt: '2099-01-01T00:00:00.000Z' } })
      return
    }
    const ids = puzzle.rounds.find((round) => round.id === body.roundId)?.conditions.map(({ id }) => id) ?? []
    const good = body.answer.toLowerCase().startsWith('good')
    await route.fulfill({
      json: { attempt: body.attempt, model: 'clef-flash', modelMs: 40, conditions: Object.fromEntries(ids.map((id) => [id, good ? { pass: true, p: 0.9 } : { pass: false, p: 0.1 }])) },
    })
  })
  await page.route('**/api/reveal/**', (route) => route.fulfill({ json: { example: 'sock', also: ['sweater', 'jeans'] } }))
}

async function turnOn(page: Page) {
  await page.getByRole('button', { name: '○ Device • off' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add a judge that runs on this device' })
  await sheet.getByRole('button', { name: 'Download' }).click()
  return page.getByRole('dialog', { name: 'On-device judge' })
}

async function guess(page: Page, answer: string) {
  const field = page.getByRole('textbox')
  await expect(field).toBeEnabled()
  await field.fill(answer)
  await field.press('Enter')
}

test.describe('the on-device judge (stubbed worker)', () => {
  test.skip(({ isMobile }) => isMobile, 'The on-device judge is offered on desktop only.')

  test('downloads with real progress, warms up, and both judges then score a guess', async ({ page }) => {
    await setUp(page, 'ready')
    await page.goto('/play/oddly-specific/1')
    const install = await turnOn(page)
    const bar = install.getByRole('progressbar')
    await expect(bar).toHaveAttribute('aria-valuenow', /^[1-9]\d?$/u)
    await expect(install.getByRole('status')).toHaveText('Warming up the judge')
    await expect(install).toBeHidden()
    await expect(page.getByText('○ Device • ready')).toBeVisible()

    await guess(page, 'bad idea')
    await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
    await expect(page.getByText(/^○ Device \d+ ms$/u)).toBeVisible()
    await expect(page.locator('.axis__ring')).toHaveCount(3)
    const records = await page.evaluate(() => JSON.parse(localStorage.getItem('quibble:comparisons') ?? '[]') as { answer: string, referee: string }[])
    expect(records).toMatchObject([{ answer: 'bad idea', referee: 'cloud' }])
  })

  test('Cancel stops the download, and the judge stays off', async ({ page }) => {
    await setUp(page, 'hang')
    await page.goto('/play/oddly-specific/1')
    const install = await turnOn(page)
    await expect(install.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
    await install.getByRole('button', { name: 'Cancel' }).click()
    await expect(install).toBeHidden()
    await expect(page.getByRole('button', { name: '○ Device • off' })).toBeVisible()
  })

  test('a Home download continues into the Library and can be cancelled there', async ({ page }) => {
    await setUp(page, 'hang')
    await page.goto('/')
    await page.getByRole('button', { name: /^Download · about/u }).click()
    await expect(page.getByText('40% downloaded')).toBeVisible()
    await page.getByRole('link', { name: 'Choose a puzzle →' }).first().click()
    await expect(page.getByText('40% downloaded')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel download', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Download · about/u })).toBeVisible()
  })

  test('a Home download becomes ready in the Library and is gone after a reload', async ({ page }) => {
    await setUp(page, 'ready')
    await page.goto('/')
    await page.getByRole('button', { name: /^Download · about/u }).click()
    await page.getByRole('link', { name: 'Choose a puzzle →' }).first().click()
    await expect(page.getByText('Qwen3.5-0.8B is ready for this visit.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: /^Download · about/u })).toBeVisible()
  })

  test('Escape during the download cancels it too', async ({ page }) => {
    await setUp(page, 'hang')
    await page.goto('/play/oddly-specific/1')
    const install = await turnOn(page)
    await expect(install.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
    await page.keyboard.press('Escape')
    await expect(install).toBeHidden()
    await expect(page.getByRole('button', { name: '○ Device • off' })).toBeVisible()
  })

  test('with the cloud resting, the device decides and nothing is compared (S1)', async ({ page }) => {
    await setUp(page, 'ready', 'resting')
    await page.goto('/play/oddly-specific/1')
    await guess(page, 'anything')
    // S2 first: the strip, and the offer on a capable device.
    await expect(page.getByRole('status', { name: 'The judges' })).toContainText('○ Device • off')
    await page.getByRole('button', { name: 'Add the on-device judge' }).click()
    await page.getByRole('dialog', { name: 'Add a judge that runs on this device' }).getByRole('button', { name: 'Download' }).click()
    await expect(page.getByRole('dialog', { name: 'On-device judge' })).toBeHidden()
    await expect(page.getByRole('status', { name: 'The judges' })).toContainText('● Device • active')

    await guess(page, 'good thing')
    await expect(page.getByText('Solved on guess 1. Not counted in the comparison.')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('quibble:comparisons'))).toBeNull()
  })

  test('the settings drawer turns the judge on and off, and sets the referee', async ({ page }) => {
    await setUp(page, 'ready')
    await page.goto('/play')
    await page.getByRole('button', { name: 'Your data' }).click()
    const drawer = page.getByRole('dialog', { name: 'Settings' })
    await expect(drawer.getByRole('radio', { name: '○ On-device' })).toBeDisabled()
    await drawer.getByRole('button', { name: 'Turn on' }).click()
    await page.getByRole('dialog', { name: 'Add a judge that runs on this device' }).getByRole('button', { name: 'Download' }).click()
    await expect(drawer.getByText('On • this visit')).toBeVisible()
    await drawer.getByRole('radio', { name: '○ On-device' }).check()
    expect(await page.evaluate(() => localStorage.getItem('quibble:settings:referee'))).toBe('device')
    await drawer.getByRole('button', { name: 'Turn off' }).click()
    await expect(drawer.getByText('Off', { exact: true })).toBeVisible()
    await expect(drawer.getByRole('radio', { name: '● Cloud' })).toBeChecked()
  })
})
