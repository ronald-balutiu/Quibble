import { describe, expect, test } from 'vitest'
import { judgeConfig } from '@shared/config'
import type { JudgeSuccess } from '@shared/schemas/judge'
import type { PuzzleCondition } from '@shared/schemas/puzzle'
import {
  letterFor,
  rejectedSentence,
  restTime,
  thresholdFor,
  toDeviceGuess,
  toGuess,
  verdictNote,
} from '@/games/shared/verdict'

// Turning judge replies into reducer guesses and the verdict sentence (plan 5.7).

const condition = (id: string, negation: string): PuzzleCondition => ({
  id,
  label: id,
  negation,
  claim: `"{answer}" is ${id}.`,
})
const conditions = [condition('a', "isn't a"), condition('b', "isn't b"), condition('c', "isn't c")]
const cloud = (scores: Record<string, { pass: boolean; p: number }>): JudgeSuccess => ({
  attempt: 0,
  model: 'clef-flash',
  modelMs: 40,
  conditions: scores,
})

describe('verdicts', () => {
  test('names conditions by letter, and uses the deciding judge’s threshold on the axes', () => {
    expect([0, 1, 2].map(letterFor)).toEqual(['A', 'B', 'C'])
    expect(thresholdFor('device', 'gemma-4')).toBe(judgeConfig.passThreshold.device)
    expect(thresholdFor('cloud', 'gemma-4')).toBe(judgeConfig.passThreshold['gemma-4'])
    expect(thresholdFor(undefined, 'clef-flash')).toBe(judgeConfig.passThreshold['clef-flash'])
  })

  test('a cloud guess passes only when every condition passes, and is close when its weakest pass is near the line', () => {
    const clear = toGuess(
      'fork',
      cloud({ a: { pass: true, p: 0.95 }, b: { pass: true, p: 0.9 }, c: { pass: true, p: 0.99 } }),
      conditions,
      'clef-flash',
    )
    expect(clear).toEqual({ answer: 'fork', pass: true, failed: [], closeCall: false })
    const close = toGuess(
      'fork',
      cloud({ a: { pass: true, p: 0.5 }, b: { pass: true, p: 0.9 }, c: { pass: true, p: 0.9 } }),
      conditions,
      'clef-flash',
    )
    expect(close.closeCall).toBe(true)
  })

  test('a failed cloud guess lists its failures, and is close when the nearest failure is', () => {
    const guess = toGuess(
      'rock',
      cloud({ a: { pass: false, p: 0.3 }, b: { pass: true, p: 0.9 }, c: { pass: false, p: 0.05 } }),
      conditions,
      'clef-flash',
    )
    expect(guess).toEqual({ answer: 'rock', pass: false, failed: ['a', 'c'], closeCall: true })
  })

  test('a condition the cloud left out never counts as a pass', () => {
    const guess = toGuess(
      'rock',
      cloud({ a: { pass: true, p: 0.9 }, b: { pass: true, p: 0.9 } }),
      conditions,
      'clef-flash',
    )
    expect(guess.pass).toBe(false)
    expect(guess.failed).toEqual([])
  })

  test('the device decides with its own threshold, and a missing score fails', () => {
    const { device } = judgeConfig.passThreshold
    const guess = toDeviceGuess('fork', { a: device + 0.2, b: device - 0.01 }, conditions)
    expect(guess).toEqual({ answer: 'fork', pass: false, failed: ['b', 'c'], closeCall: true })
    expect(toDeviceGuess('fork', { a: 1, b: 1, c: 1 }, conditions)).toMatchObject({ pass: true, closeCall: false })
  })

  test('the rejected sentence names one failure in words, several by letter or level, and notes a close call', () => {
    const one = { answer: 'rock', pass: false, failed: ['b'], closeCall: false }
    expect(rejectedSentence(one, conditions)).toBe("It isn't b.")
    expect(rejectedSentence({ ...one, closeCall: true }, conditions)).toBe("It isn't b. Close call.")
    const two = { ...one, failed: ['a', 'c'] }
    expect(rejectedSentence(two, conditions)).toBe('It misses A and C.')
    expect(rejectedSentence(two, conditions, (i) => `L-0${String(i + 1)}`)).toBe('It misses L-01 and L-03.')
  })

  test('the note says when the judges split, and when a device verdict isn’t compared', () => {
    const scored = (agreed: number) => ({ kind: 'scored' as const, scores: {}, ms: 100, agreed, compared: 3 })
    expect(verdictNote({ run: scored(3) })).toBe('')
    expect(verdictNote({ run: scored(2) })).toBe(' The judges disagree.')
    expect(verdictNote({ decidedBy: 'device' })).toBe(' Not counted in the comparison.')
    expect(verdictNote({ decidedBy: 'device', run: scored(2) })).toBe(' The judges disagree.')
    expect(verdictNote({ decidedBy: 'cloud', run: { kind: 'scanning', started: 0 } })).toBe('')
  })

  test('the resting time is shown in hours and minutes', () => {
    expect(restTime('2026-11-03T15:05:00Z')).toBe(
      new Date('2026-11-03T15:05:00Z').toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    )
  })
})
