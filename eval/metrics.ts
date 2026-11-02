import { passes } from '@shared/config'
import type { AnswerKeyCase } from '@shared/schemas/answer-key'

// Answer-key metrics (plan 3.10). Unsure labels are left out of condition
// metrics, and a guess with any unsure label is left out of whole-guess metrics.

export interface CaseResult {
  id: string
  scores: Record<string, number> // condition id → P(yes)
  latencyMs: number
  neurons?: number
}

interface Interval { value: number, low: number, high: number, n: number }

interface Metrics {
  conditions: { n: number, accuracy: Interval, falseAccepts: number, falseRejects: number, brier: number }
  guesses: { n: number, accuracy: Interval, falseAcceptRate: Interval, falseRejectRate: Interval }
  reliability: { bin: number, n: number, meanP: number | null, observed: number | null }[] // null for an empty bin
  latencyMs: { median: number, p95: number }
  neuronsPerGuess?: number
}

interface Row { pairs: { p: number, yes: boolean, pass: boolean }[], wholeKnown: boolean, expectedPass: boolean, predictedPass: boolean }

function rows(cases: readonly AnswerKeyCase[], results: ReadonlyMap<string, CaseResult>, threshold: number): Row[] {
  return cases.map((c) => {
    const scores = results.get(c.id)?.scores
    if (!scores) throw new Error(`No result for ${c.id}.`)
    const pairs = c.conditions.flatMap(({ id, expected }) => {
      const p = scores[id]
      if (p === undefined) throw new Error(`No score for ${c.id} ${id}.`)
      return expected === 'unsure' ? [] : [{ p, yes: expected === 'yes', pass: passes(p, threshold) }]
    })
    return {
      pairs,
      wholeKnown: c.conditions.every(({ expected }) => expected !== 'unsure'),
      expectedPass: c.conditions.every(({ expected }) => expected === 'yes'),
      predictedPass: c.conditions.every(({ id }) => passes(scores[id] ?? 0, threshold)),
    }
  })
}

const ratio = (hits: number, total: number) => (total === 0 ? Number.NaN : hits / total)

function conditionAccuracy(sample: Row[]) {
  const pairs = sample.flatMap((row) => row.pairs)
  return ratio(pairs.filter(({ pass, yes }) => pass === yes).length, pairs.length)
}

function guessRates(sample: Row[]) {
  const whole = sample.filter((row) => row.wholeKnown)
  const fails = whole.filter((row) => !row.expectedPass)
  const passing = whole.filter((row) => row.expectedPass)
  return {
    accuracy: ratio(whole.filter((row) => row.predictedPass === row.expectedPass).length, whole.length),
    falseAcceptRate: ratio(fails.filter((row) => row.predictedPass).length, fails.length),
    falseRejectRate: ratio(passing.filter((row) => !row.predictedPass).length, passing.length),
  }
}

// Seeded so a rerun on the same results reproduces the same intervals.
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

function percentile(sorted: number[], q: number) {
  if (sorted.length === 0) return Number.NaN
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? Number.NaN
}

// 95% bootstrap interval, resampling whole guesses.
function bootstrap(all: Row[], statistic: (sample: Row[]) => number, n: number, resamples = 1000): Interval {
  const next = random(20261029)
  const values: number[] = []
  for (let r = 0; r < resamples; r++) {
    const sample = Array.from({ length: all.length }, () => all[Math.floor(next() * all.length)] as Row)
    const value = statistic(sample)
    if (!Number.isNaN(value)) values.push(value)
  }
  values.sort((a, b) => a - b)
  return { value: statistic(all), low: percentile(values, 0.025), high: percentile(values, 0.975), n }
}

export function computeMetrics(cases: readonly AnswerKeyCase[], results: ReadonlyMap<string, CaseResult>, threshold: number): Metrics {
  const all = rows(cases, results, threshold)
  const pairs = all.flatMap((row) => row.pairs)
  const whole = all.filter((row) => row.wholeKnown)
  const latencies = cases.map((c) => results.get(c.id)?.latencyMs ?? 0).sort((a, b) => a - b)
  const neurons = cases.map((c) => results.get(c.id)?.neurons)

  const reliability = Array.from({ length: 10 }, (_, bin) => {
    const inBin = pairs.filter(({ p }) => Math.min(9, Math.floor(p * 10)) === bin)
    return {
      bin,
      n: inBin.length,
      meanP: inBin.length === 0 ? null : inBin.reduce((total, { p }) => total + p, 0) / inBin.length,
      observed: inBin.length === 0 ? null : inBin.filter(({ yes }) => yes).length / inBin.length,
    }
  })

  const metrics: Metrics = {
    conditions: {
      n: pairs.length,
      accuracy: bootstrap(all, conditionAccuracy, pairs.length),
      falseAccepts: pairs.filter(({ pass, yes }) => !yes && pass).length,
      falseRejects: pairs.filter(({ pass, yes }) => yes && !pass).length,
      brier: ratio(pairs.reduce((total, { p, yes }) => total + (p - (yes ? 1 : 0)) ** 2, 0), pairs.length),
    },
    guesses: {
      n: whole.length,
      accuracy: bootstrap(all, (s) => guessRates(s).accuracy, whole.length),
      falseAcceptRate: bootstrap(all, (s) => guessRates(s).falseAcceptRate, whole.filter((r) => !r.expectedPass).length),
      falseRejectRate: bootstrap(all, (s) => guessRates(s).falseRejectRate, whole.filter((r) => r.expectedPass).length),
    },
    reliability,
    latencyMs: { median: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
  }
  if (neurons.every((value) => value !== undefined)) {
    metrics.neuronsPerGuess = neurons.reduce((total, value) => total + value, 0) / neurons.length
  }
  return metrics
}

// Cohen's κ between two judges' pass/fail decisions on every condition (agreement, not correctness).
interface JudgedRun { results: ReadonlyMap<string, CaseResult>, threshold: number }

export function cohensKappa(cases: readonly AnswerKeyCase[], a: JudgedRun, b: JudgedRun): number {
  const decide = (run: JudgedRun, caseId: string, id: string) => passes(run.results.get(caseId)?.scores[id] ?? Number.NaN, run.threshold)
  const decisions = cases.flatMap((c) => c.conditions.map(({ id }) => [decide(a, c.id, id), decide(b, c.id, id)] as const))
  const n = decisions.length
  const observed = decisions.filter(([x, y]) => x === y).length / n
  const pa = decisions.filter(([x]) => x).length / n
  const pb = decisions.filter(([, y]) => y).length / n
  const expected = pa * pb + (1 - pa) * (1 - pb)
  return expected === 1 ? 1 : (observed - expected) / (1 - expected)
}

// Whole-guess accuracy and false-accept rate at candidate thresholds, for tuning
// each judge's pass threshold on the development set.
export function thresholdSweep(cases: readonly AnswerKeyCase[], results: ReadonlyMap<string, CaseResult>, thresholds: readonly number[]) {
  return thresholds.map((threshold) => {
    const all = rows(cases, results, threshold)
    return { threshold, conditionAccuracy: conditionAccuracy(all), ...guessRates(all) }
  })
}
