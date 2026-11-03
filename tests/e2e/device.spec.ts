import { expect, test, type Page } from '@playwright/test'
import {
  allConditions,
  mockJudge,
  mockReveal,
  seedStorage,
  shippedPuzzle,
  stubDeviceJudge,
  submitGuess,
} from './support'

// The on-device judge with a stubbed worker (Phase 5), since CI's browser has no
// WebGPU (support.ts, stubDeviceJudge). The real model runs only locally, in
// tests/device/real-model.spec.ts (npm run test:device).

const puzzle = shippedPuzzle('oddly-specific')

// `hang`: the download stops at 40% until cancelled. The cloud judge passes
// answers starting with "good" and fails the rest, unless it's resting.
async function setUp(page: Page, mode: 'ready' | 'hang', cloud: 'judge' | 'resting' = 'judge') {
  await seedStorage(page, { 'quibble:settings:tipsSeen': 'oddly-specific' }, { everyLoad: true })
  await stubDeviceJudge(page, mode === 'hang' ? { pauseAt: 0.4 } : {})
  await mockJudge(page, (request) =>
    cloud === 'resting'
      ? { status: 503, json: { attempt: request.attempt, error: 'resting', resetAt: '2099-01-01T00:00:00.000Z' } }
      : allConditions(puzzle, request, request.answer.toLowerCase().startsWith('good')),
  )
  await mockReveal(page)
}

async function turnOn(page: Page) {
  await page.getByRole('button', { name: '○ Device • off' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add a judge that runs on this device' })
  await sheet.getByRole('button', { name: 'Download' }).click()
  return page.getByRole('dialog', { name: 'On-device judge' })
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

    await submitGuess(page, 'bad idea')
    await expect(page.getByText('VERDICT • REJECTED')).toBeVisible()
    await expect(page.getByText(/^○ Device \d+ ms$/u)).toBeVisible()
    await expect(page.locator('.axis__ring')).toHaveCount(3)
    const records = await page.evaluate(
      () => JSON.parse(localStorage.getItem('quibble:comparisons') ?? '[]') as { answer: string; referee: string }[],
    )
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

  test('a Library download survives a visit to Home and can be cancelled on return', async ({ page }) => {
    await setUp(page, 'hang')
    await page.goto('/play')
    await page.getByRole('button', { name: /^Download · about/u }).click()
    await expect(page.getByText('40% downloaded')).toBeVisible()
    await page.getByRole('link', { name: 'Home', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Make your case.' })).toBeVisible()
    await page.getByRole('link', { name: 'Choose a puzzle →' }).first().click()
    await expect(page.getByText('40% downloaded')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel download', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Download · about/u })).toBeVisible()
  })

  test('a Library download becomes ready across navigation and is gone after a reload', async ({ page }) => {
    await setUp(page, 'ready')
    await page.goto('/play')
    await page.getByRole('button', { name: /^Download · about/u }).click()
    await page.getByRole('link', { name: 'Home', exact: true }).click()
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
    await submitGuess(page, 'anything')
    // S2 first: the strip, and the offer on a capable device.
    await expect(page.getByRole('status', { name: 'The judges' })).toContainText('○ Device • off')
    await page.getByRole('button', { name: 'Add the on-device judge' }).click()
    await page
      .getByRole('dialog', { name: 'Add a judge that runs on this device' })
      .getByRole('button', { name: 'Download' })
      .click()
    await expect(page.getByRole('dialog', { name: 'On-device judge' })).toBeHidden()
    await expect(page.getByRole('status', { name: 'The judges' })).toContainText('● Device • active')

    await submitGuess(page, 'good thing')
    await expect(page.getByText('Solved on guess 1. Not counted in the comparison.')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('quibble:comparisons'))).toBeNull()
  })

  test('the settings drawer turns the judge on and off, and sets the referee', async ({ page }) => {
    await setUp(page, 'ready')
    await page.goto('/play')
    await page.getByRole('button', { name: 'Settings' }).click()
    const drawer = page.getByRole('dialog', { name: 'Settings' })
    await expect(drawer.getByRole('radio', { name: 'On-device', exact: true })).toBeDisabled()
    await drawer.getByRole('button', { name: 'Turn on' }).click()
    await page
      .getByRole('dialog', { name: 'Add a judge that runs on this device' })
      .getByRole('button', { name: 'Download' })
      .click()
    await expect(drawer.getByText('On • this visit')).toBeVisible()
    await drawer.getByRole('radio', { name: 'On-device', exact: true }).check()
    expect(await page.evaluate(() => localStorage.getItem('quibble:settings:referee'))).toBe('device')
    await drawer.getByRole('button', { name: 'Turn off' }).click()
    await expect(drawer.getByText('Off', { exact: true })).toBeVisible()
    await expect(drawer.getByRole('radio', { name: 'Cloud', exact: true })).toBeChecked()
  })
})
