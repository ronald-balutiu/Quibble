import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { GameId } from '../../shared/games'
import { defaultCloudModel, judgeRequestSchema, revealSchema, type CloudModel, type JudgeRequest, type JudgeSuccess, type Reveal } from '../../shared/schemas/judge'
import { puzzleSchema, type Puzzle } from '../../shared/schemas/puzzle'

// Shared setup for the browser tests: a mocked API (no model calls, no Turnstile),
// fixture puzzles, storage seeding and guesses. Each spec keeps only its own rule
// for which answers pass.

export type { JudgeRequest } from '../../shared/schemas/judge'

export const readPuzzle = (path: string) => puzzleSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
export const shippedPuzzle = (game: GameId, n = 1) => readPuzzle(`public/puzzles/${game}/${String(n)}.json`)
export const conditionsOf = (puzzle: Puzzle, roundId: string) => puzzle.rounds.find((round) => round.id === roundId)?.conditions.map(({ id }) => id) ?? []

// Serves a fixed puzzle file, so a test doesn't depend on the shipped library.
export async function servePuzzle(page: Page, game: GameId, n: number, path: string) {
  const puzzle = readPuzzle(path)
  await page.route(`**/puzzles/${game}/${String(n)}.json`, (route) => route.fulfill({ json: puzzle }))
}

// A reply for /api/judge: each condition's verdict, an error status, or no reply
// at all (for the 10-second timeout).
export type JudgeReply = { passes: Record<string, boolean>, model?: CloudModel, modelMs?: number } | { status: number, json: unknown } | 'hang'

export async function mockJudge(page: Page, reply: (request: JudgeRequest) => JudgeReply, { delayMs = 0 } = {}) {
  await page.route('**/api/judge', async (route) => {
    const request = judgeRequestSchema.parse(route.request().postDataJSON())
    const result = reply(request)
    if (result === 'hang') return
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
    if ('status' in result) {
      await route.fulfill({ status: result.status, json: result.json })
      return
    }
    await route.fulfill({
      json: {
        attempt: request.attempt, model: result.model ?? request.model ?? defaultCloudModel, modelMs: result.modelMs ?? 40,
        conditions: Object.fromEntries(Object.entries(result.passes).map(([id, pass]) => [id, pass ? { pass: true, p: 0.9 } : { pass: false, p: 0.1 }])),
      } satisfies JudgeSuccess,
    })
  })
}

// The same verdict for every condition of the round.
export const allConditions = (puzzle: Puzzle, request: JudgeRequest, pass: boolean) =>
  ({ passes: Object.fromEntries(conditionsOf(puzzle, request.roundId).map((id) => [id, pass])) })

export async function mockReveal(page: Page, reply: (roundId: string) => Reveal = () => ({ example: 'sock', also: ['sweater', 'jeans'] })) {
  await page.route('**/api/reveal/**', (route) => route.fulfill({ json: revealSchema.parse(reply(route.request().url().split('/').at(-1) ?? '')) }))
}

// Seeds localStorage before the page's scripts run. By default only on the first
// load of the test, so later reloads see what the app saved.
export async function seedStorage(page: Page, entries: Record<string, string>, { everyLoad = false } = {}) {
  await page.addInitScript(({ values, once }) => {
    if (once) {
      if (sessionStorage.getItem('quibble-test:seeded')) return
      sessionStorage.setItem('quibble-test:seeded', '1')
    }
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
  }, { values: entries, once: !everyLoad })
}

export const tipsSeen = { 'quibble:settings:tipsSeen': 'oddly-specific,category-escape,double-agent' }

// Keyboard-only: the answer field must already have focus, as the game gives it.
export async function typeGuess(page: Page, answer: string) {
  await expect(page.getByRole('textbox')).toBeFocused()
  await page.keyboard.type(answer)
  await page.keyboard.press('Enter')
}

// Fills and submits the answer field once it's enabled.
export async function submitGuess(page: Page, answer: string) {
  const field = page.getByRole('textbox')
  await expect(field).toBeEnabled()
  await field.fill(answer)
  await field.press('Enter')
}

// Tabs until the named button has focus, then presses it.
export async function tabToButton(page: Page, name: string) {
  await expect(async () => {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name })).toBeFocused({ timeout: 200 })
  }).toPass()
  await page.keyboard.press('Enter')
}

// The on-device judge without WebGPU (CI has none): the page sees a fake adapter,
// and the built worker is swapped for a script that speaks the same protocol
// (src/judges/device/protocol.ts). The download pauses at `pauseAt` (a fraction)
// until cancelled, or for `resumeAfterMs` if given. Answers starting with "good"
// score 0.9 on every claim, anything else 0.2.
export async function stubDeviceJudge(page: Page, { pauseAt, resumeAfterMs }: { pauseAt?: number, resumeAfterMs?: number } = {}) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'gpu', { get: () => ({ requestAdapter: () => Promise.resolve({}) }) })
  })
  const worker = `
    const total = 570483465
    const pauseAt = ${JSON.stringify(pauseAt ?? null)}
    const resumeAfterMs = ${JSON.stringify(resumeAfterMs ?? null)}
    let timer
    const finish = () => {
      self.postMessage({ type: 'progress', received: total, total })
      self.postMessage({ type: 'warming' })
      setTimeout(() => self.postMessage({ type: 'ready' }), 300)
    }
    self.onmessage = ({ data }) => {
      if (data.type === 'load') {
        let received = 0
        self.postMessage({ type: 'progress', received, total })
        timer = setInterval(() => {
          received = Math.min(total, received + total / 10)
          if (pauseAt !== null && received >= total * pauseAt) {
            clearInterval(timer)
            self.postMessage({ type: 'progress', received: total * pauseAt, total })
            if (resumeAfterMs !== null) timer = setTimeout(finish, resumeAfterMs)
            return
          }
          if (received >= total) { clearInterval(timer); finish(); return }
          self.postMessage({ type: 'progress', received, total })
        }, 80)
      }
      if (data.type === 'cancel') { clearInterval(timer); clearTimeout(timer); self.postMessage({ type: 'cancelled' }) }
      if (data.type === 'delete') { clearInterval(timer); clearTimeout(timer); self.postMessage({ type: 'deleted' }) }
      if (data.type === 'score') {
        const p = data.answer.startsWith('good') ? 0.9 : 0.2
        setTimeout(() => self.postMessage({ type: 'scored', id: data.id, scores: Object.fromEntries(data.claims.map((c) => [c.id, p])) }), 50)
      }
    }
  `
  await page.route('**/assets/worker-*.js', (route) => route.fulfill({ contentType: 'text/javascript', body: worker }))
}
