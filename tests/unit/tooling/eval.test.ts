import { describe, expect, test } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import type { AnswerKeyCase } from '@shared/schemas/answer-key'
import { evalHistorySchema } from '@shared/schemas/eval-history'
import { cohensKappa, computeMetrics, thresholdSweep, type CaseResult } from '../../../eval/metrics'
import { gemmaPYes } from '../../../eval/judges'
import gemma from '../../fixtures/clef/gemma-4-success.json'

function guess(id: string, expected: ('yes' | 'no' | 'unsure')[]): AnswerKeyCase {
  return {
    id: `os-01-${id}`, game: 'oddly-specific', group: 'os-01', answer: id, kind: 'clear', reviewed: true,
    conditions: expected.map((label, i) => ({ id: `c${String(i)}`, expected: label })),
  }
}
const result = (c: AnswerKeyCase, ps: number[]): [string, CaseResult] =>
  [c.id, { id: c.id, latencyMs: 10, neurons: 1, scores: Object.fromEntries(ps.map((p, i) => [`c${String(i)}`, p])) }]

describe('answer-key metrics', () => {
  const cases = [guess('1', ['yes', 'yes']), guess('2', ['yes', 'no']), guess('3', ['no', 'no']), guess('4', ['yes', 'unsure'])]
  const results = new Map([
    result(cases[0]!, [0.9, 0.8]), // correct pass
    result(cases[1]!, [0.9, 0.7]), // false accept on c1
    result(cases[2]!, [0.1, 0.2]), // correct fail
    result(cases[3]!, [0.6, 0.1]), // unsure condition is ignored
  ])
  const metrics = computeMetrics(cases, results, 0.5)

  test('counts conditions without unsure labels', () => {
    expect(metrics.conditions.n).toBe(7)
    expect(metrics.conditions.falseAccepts).toBe(1)
    expect(metrics.conditions.falseRejects).toBe(0)
    expect(metrics.conditions.accuracy.value).toBeCloseTo(6 / 7)
  })

  test('leaves guesses with an unsure label out of whole-guess metrics', () => {
    expect(metrics.guesses.n).toBe(3)
    expect(metrics.guesses.accuracy.value).toBeCloseTo(2 / 3)
    expect(metrics.guesses.falseAcceptRate.value).toBeCloseTo(1 / 2)
    expect(metrics.guesses.falseRejectRate.value).toBe(0)
  })

  test('reports bootstrap intervals around the value, and Neurons per guess', () => {
    const { accuracy } = metrics.guesses
    expect(accuracy.low).toBeLessThanOrEqual(accuracy.value)
    expect(accuracy.high).toBeGreaterThanOrEqual(accuracy.value)
    expect(metrics.neuronsPerGuess).toBe(1)
  })

  test("Cohen's κ is 1 for identical judges", () => {
    expect(cohensKappa(cases, { results, threshold: 0.5 }, { results, threshold: 0.5 })).toBe(1)
  })

  test('the threshold sweep moves false accepts down as the threshold rises', () => {
    const [low, high] = thresholdSweep(cases, results, [0.5, 0.75])
    expect(low?.falseAcceptRate).toBeCloseTo(1 / 2)
    expect(high?.falseAcceptRate).toBe(0)
  })
})

describe('Gemma logprob reader', () => {
  test.each(gemma.calls.map((call) => [call.id, call] as const))('reads P(yes) from the recorded %s call', (_id, call) => {
    const p = gemmaPYes(call.response.body.result)
    const answered = call.response.body.result.choices[0]?.message.content
    expect(p > 0.5).toBe(answered === 'YES')
  })

  test('rejects a reply without logprobs', () => {
    expect(() => gemmaPYes({ choices: [{ message: { content: 'YES' } }] })).toThrow()
  })
})

test('eval/history.json matches its schema', () => {
  if (!existsSync('eval/history.json')) return
  expect(() => evalHistorySchema.parse(JSON.parse(readFileSync('eval/history.json', 'utf8')))).not.toThrow()
})
