import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus, platform } from 'node:os'

// The real on-device judge in Chrome on WebGPU, local only (playwright.device.config.ts).
// It loads the built worker directly and talks to it over the same protocol as the
// game (src/judges/device/protocol.ts).

interface ParityCase { id: string, answer: string, claim: string }
const fixtures = 'tests/fixtures/verdict'
const cases = JSON.parse(readFileSync(`${fixtures}/cases.json`, 'utf8')) as ParityCase[]
const reference = JSON.parse(readFileSync(`${fixtures}/python-reference.json`, 'utf8')) as { results: { id: string, p: number }[] }
const workerFile = readdirSync('dist/client/assets').find((file) => /^worker-.*\.js$/u.test(file))

// The page's Worker, typed here because this project has no DOM types.
interface Reply { type: string, reason?: string, scores?: Record<string, number> }
interface PageWorker { onmessage: ((event: { data: Reply }) => void) | null, postMessage: (message: unknown) => void }
interface PageGlobals { Worker: new (url: string, options: { type: 'module' }) => PageWorker, judge: PageWorker }

// Resident memory of the test's Chrome, all processes together: they are the ones
// started with Playwright's temporary profile. On a Mac, WebGPU buffers count here too.
function chromeMegabytes(): number {
  const lines = execFileSync('ps', ['-axo', 'rss=,command='], { encoding: 'utf8' }).split('\n')
  const kb = lines.filter((line) => line.includes('playwright_chromiumdev_profile')).reduce((sum, line) => sum + Number.parseInt(line, 10), 0)
  return Math.round(kb / 1024)
}

// Starts the worker in the page and returns how long the cold load took.
async function startJudge(page: Page): Promise<number> {
  await page.goto('/')
  return page.evaluate(async (url) => {
    const page = globalThis as unknown as PageGlobals
    const worker = new page.Worker(url, { type: 'module' })
    page.judge = worker
    const started = performance.now()
    await new Promise<void>((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        if (data.type === 'ready') resolve()
        if (data.type === 'failed') reject(new Error(`load failed: ${String(data.reason)}`))
      }
      worker.postMessage({ type: 'load' })
    })
    return performance.now() - started
  }, `/assets/${String(workerFile)}`)
}

// Scores claims as one guess and returns the scores and the guess's time in ms.
function score(page: Page, answer: string, claims: { id: string, claim: string }[]) {
  return page.evaluate(async ({ answer, claims }) => {
    const worker = (globalThis as unknown as PageGlobals).judge
    const started = performance.now()
    const scores = await new Promise<Record<string, number>>((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        if (data.type === 'scored') resolve(data.scores ?? {})
        if (data.type === 'scoreFailed') reject(new Error('score failed'))
      }
      worker.postMessage({ type: 'score', id: 1, answer, claims })
    })
    return { scores, ms: performance.now() - started }
  }, { answer, claims })
}

// Starts a second download in a fresh worker and stops it a third of the way in,
// with Cancel or with turning the judge off; returns how long the stop took.
function stopMidDownload(page: Page, stop: 'cancel' | 'delete'): Promise<number> {
  return page.evaluate(async ({ url, stop }) => {
    const worker = new (globalThis as unknown as PageGlobals).Worker(url, { type: 'module' })
    let asked = 0
    return new Promise<number>((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        const progress = data as Reply & { received?: number, total?: number }
        if (data.type === 'progress' && !asked && (progress.received ?? 0) > (progress.total ?? 1) / 3) {
          asked = performance.now()
          worker.postMessage({ type: stop })
        }
        if (data.type === (stop === 'cancel' ? 'cancelled' : 'deleted')) resolve(performance.now() - asked)
        if (data.type === 'ready' || data.type === 'failed') reject(new Error(`not stopped: ${data.type}`))
      }
      worker.postMessage({ type: 'load' })
    })
  }, { url: `/assets/${String(workerFile)}`, stop })
}

test('WebGPU scores match the Python reference within 0.02, and speed is recorded', async ({ page, browser }) => {
  expect(workerFile, 'build first: the worker asset is missing').toBeDefined()
  await page.goto('/')
  const baselineMb = chromeMegabytes()
  let peakMb = baselineMb
  const sampler = setInterval(() => { peakMb = Math.max(peakMb, chromeMegabytes()) }, 250)
  const coldMs = await startJudge(page)
  // Whole guesses of three claims, as in Oddly Specific. The first after the load is
  // the cold run, which includes WebGPU's start-up work.
  const three = cases.slice(0, 3).map(({ id, claim }) => ({ id, claim }))
  const first = (await score(page, 'coin', three)).ms

  const results: { id: string, p: number }[] = []
  for (const { id, answer, claim } of cases) {
    const { scores } = await score(page, answer, [{ id, claim }])
    results.push({ id, p: scores[id] ?? Number.NaN })
  }
  const runtime = 'onnxruntime-web 1.31.1 (WebGPU, q4)'
  writeFileSync(`${fixtures}/browser-webgpu.json`, `${JSON.stringify({ runtime, results }, null, 2)}\n`)
  for (const { id, p } of results) {
    const expected = reference.results.find((r) => r.id === id)?.p
    expect(Math.abs(p - Number(expected)), id).toBeLessThanOrEqual(0.02)
  }

  const warm: number[] = []
  for (let i = 0; i < 20; i++) warm.push((await score(page, cases[i % cases.length]?.answer ?? 'coin', three)).ms)
  clearInterval(sampler)
  const settledMb = chromeMegabytes()
  peakMb = Math.max(peakMb, settledMb)
  warm.sort((a, b) => a - b)
  const at = (q: number) => warm[Math.min(warm.length - 1, Math.floor(q * warm.length))] ?? 0
  const cancelMs = await stopMidDownload(page, 'cancel')
  const turnOffMs = await stopMidDownload(page, 'delete')
  const device = {
    machine: process.env.DEVICE_NAME ?? `${cpus()[0]?.model ?? 'unknown CPU'} (${platform()})`,
    browser: `Chrome ${browser.version()}`,
    measuredAt: new Date().toISOString().slice(0, 10),
    coldLoadSeconds: Number((coldMs / 1000).toFixed(1)),
    firstGuessMs: Math.round(first),
    warmGuessMedianMs: Math.round(at(0.5)),
    warmGuessP95Ms: Math.round(at(0.95)),
    guesses: warm.length,
    // The whole test browser, before the load, at its peak, and once the judge is warm.
    browserMemoryMb: { before: baselineMb, peak: peakMb, warm: settledMb },
    // How long Cancel and turning the judge off take a third of the way into a download.
    cancelMs: Math.round(cancelMs),
    turnOffMs: Math.round(turnOffMs),
  }
  const path = 'eval/device-measurements.json'
  let recorded: (typeof device)[] = []
  try { recorded = JSON.parse(readFileSync(path, 'utf8')) as (typeof device)[] } catch { /* first run */ }
  writeFileSync(path, `${JSON.stringify([...recorded.filter((d) => d.machine !== device.machine || d.browser !== device.browser), device], null, 2)}\n`)
  console.log(JSON.stringify(device))
})
