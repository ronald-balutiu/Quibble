import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { PuzzleCondition } from '@shared/schemas/puzzle'
import type { DeviceJudge, ScoreResult } from '@/judges/device/client'
import { COMPARISON_LIMITS, loadComparisons, markOverruled, saveComparison, type Comparison } from '@/lib/storage/comparisons'
import { judgeGuess, toComparison, type DeviceRun, type JudgeTurn } from '@/scenes/game/judge-guess'
import { judgesSplit } from '@/scenes/game/verdict'

const conditions: PuzzleCondition[] = [
  { id: 'pocket', label: 'Fits in a pocket', negation: "doesn't fit in a pocket", claim: '{answer} fits in a pocket' },
  { id: 'secure', label: 'Can secure something', negation: "can't secure something", claim: '{answer} can secure something' },
]
const turn: JudgeTurn = {
  game: 'oddly-specific', n: 1, roundId: 'r1', text: 'Carabiner', normalized: 'carabiner', attempt: 1, model: 'clef-flash', conditions, turnstile: null,
}
const cloud = { attempt: 1, model: 'clef-flash' as const, modelMs: 41, conditions: { pocket: { pass: true, p: 0.97 }, secure: { pass: false, p: 0.3 } } }

function memoryStorage() {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) })
  return data
}

const record = (at: number, answer = 'carabiner'): Comparison => toComparison({ ...turn, normalized: answer }, cloud, 300, { scores: { pocket: 0.9, secure: 0.8 }, ms: 120, warm: true }, at)

describe('comparison records (3.8)', () => {
  beforeEach(() => { memoryStorage() })

  test('a record holds both scores and verdicts per condition, both latencies and the referee', () => {
    expect(record(5)).toEqual({
      at: 5, game: 'oddly-specific', n: 1, round: 'r1', answer: 'carabiner',
      conditions: {
        pocket: { cloud: 0.97, cloudPass: true, device: 0.9, devicePass: true },
        secure: { cloud: 0.3, cloudPass: false, device: 0.8, devicePass: true },
      },
      cloudModel: 'clef-flash', cloudMs: 300, cloudModelMs: 41, deviceMs: 120,
      backend: 'webgpu', precision: 'q4', warm: true, referee: 'cloud', overruled: false,
    })
  })

  test('drops records older than 90 days, and keeps the newest 2,000', () => {
    const day = 24 * 60 * 60 * 1000
    saveComparison(record(0), 0)
    saveComparison(record(1), COMPARISON_LIMITS.days * day)
    expect(loadComparisons(COMPARISON_LIMITS.days * day).map(({ at }) => at)).toEqual([1])
    // Records without conditions are small enough that the count limit comes first.
    const small = (at: number) => ({ ...record(at), conditions: {} })
    globalThis.localStorage.setItem('quibble:comparisons', JSON.stringify(Array.from({ length: COMPARISON_LIMITS.records }, (_, i) => small(i))))
    saveComparison(small(COMPARISON_LIMITS.records), COMPARISON_LIMITS.records)
    const kept = loadComparisons(COMPARISON_LIMITS.records)
    expect(kept).toHaveLength(COMPARISON_LIMITS.records)
    expect([kept[0]?.at, kept.at(-1)?.at]).toEqual([1, COMPARISON_LIMITS.records])
  })

  test('stays under 500 KB by dropping the oldest', () => {
    globalThis.localStorage.setItem('quibble:comparisons', JSON.stringify(Array.from({ length: 1_900 }, (_, i) => record(i))))
    saveComparison(record(1_900), 1_900)
    const raw = globalThis.localStorage.getItem('quibble:comparisons') ?? ''
    expect(raw.length).toBeLessThanOrEqual(COMPARISON_LIMITS.bytes)
    expect(loadComparisons(2_000).at(-1)?.at).toBe(1_900)
  })

  test('"Count it anyway" marks the latest matching record, and bad records are dropped', () => {
    const data = memoryStorage()
    data.set('quibble:comparisons', JSON.stringify([{ at: 1, broken: true }]))
    saveComparison(record(2), 2)
    markOverruled('oddly-specific', 1, 'r1', 'carabiner', 2)
    expect(loadComparisons(2)).toEqual([{ ...record(2), overruled: true }])
  })

  test('blocked storage loses the record but never throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } })
    expect(() => { saveComparison(record(1)) }).not.toThrow()
    expect(loadComparisons()).toEqual([])
  })
})

describe('both judges on one guess (3.7)', () => {
  beforeEach(() => {
    memoryStorage()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(cloud), { status: 200 }))))
  })

  function fakeDevice(results: ScoreResult[]): DeviceJudge {
    return { ready: true, score: vi.fn(() => Promise.resolve(results.shift() ?? { kind: 'error' })) } as unknown as DeviceJudge
  }

  test('the cloud scores land first, but the guess resolves only once the device is back', async () => {
    const events: string[] = []
    let finish: (result: ScoreResult) => void = () => undefined
    const device = { ready: true, score: vi.fn(() => new Promise<ScoreResult>((resolve) => { finish = resolve })) } as unknown as DeviceJudge
    let done = false
    const judging = judgeGuess(turn, {
      device,
      onCloud: (_scores, ms) => events.push(`cloud ${String(ms)}`),
      onDevice: (run) => events.push(run.kind === 'scored' ? `device ${String(run.agreed)}/${String(run.compared)}` : run.kind),
    }).then((result) => { done = true; return result })
    await vi.waitFor(() => { expect(events).toEqual(['scanning', 'cloud 41']) })
    expect(done).toBe(false)
    finish({ kind: 'scored', scores: { pocket: 0.9, secure: 0.8 }, ms: 120, warm: false })
    expect(await judging).toMatchObject({ guess: { pass: false, failed: ['secure'] }, modelMs: 41 })
    expect(events).toEqual(['scanning', 'cloud 41', 'device 1/2'])
    expect(loadComparisons()).toHaveLength(1)
  })

  test('a device timeout only marks its column, and Retry scores the same answer again', async () => {
    const runs: DeviceRun[] = []
    const device = fakeDevice([{ kind: 'timeout' }, { kind: 'scored', scores: { pocket: 0.9, secure: 0.1 }, ms: 90, warm: true }])
    const result = await judgeGuess(turn, { onDevice: (run) => runs.push(run), device })
    expect(result).toMatchObject({ guess: { pass: false } })
    expect(runs.at(-1)?.kind).toBe('timeout')
    expect(loadComparisons()).toEqual([])
    const last = runs.at(-1)
    if (last?.kind === 'timeout') last.retry()
    await vi.waitFor(() => { expect(runs.at(-1)).toMatchObject({ kind: 'scored', agreed: 2, compared: 2 }) })
    expect(device.score).toHaveBeenLastCalledWith('carabiner', [{ id: 'pocket', claim: '{answer} fits in a pocket' }, { id: 'secure', claim: '{answer} can secure something' }])
  })

  test('with the judge off, nothing runs on the device', async () => {
    const runs: DeviceRun[] = []
    const off = { ready: false, score: vi.fn() } as unknown as DeviceJudge
    await judgeGuess(turn, { onDevice: (run) => runs.push(run), device: off })
    expect(off.score).not.toHaveBeenCalled()
    expect(runs).toEqual([])
  })

  test('the judges split when any condition gets a different verdict', () => {
    const scored = (scores: Record<string, number>): DeviceRun => ({ kind: 'scored', scores, ms: 1, agreed: 0, compared: 2 })
    expect(judgesSplit(scored({ pocket: 0.9, secure: 0.1 }), ['secure'], conditions)).toBe(false)
    expect(judgesSplit(scored({ pocket: 0.9, secure: 0.8 }), ['secure'], conditions)).toBe(true)
    expect(judgesSplit({ kind: 'scanning', started: 0 }, ['secure'], conditions)).toBeUndefined()
  })
})
