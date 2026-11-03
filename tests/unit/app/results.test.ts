import { describe, expect, test } from 'vitest'
import { judgeConfig } from '@shared/config'
import { en, format } from '@/copy/en'
import { bestNote, shareText } from '@/games/shared/results'
import { thresholdFor } from '@/games/shared/verdict'

describe('bestNote', () => {
  test.each([
    [9, undefined, en['results.firstPlay']],
    [12, 9, format('results.newBest', { n: 9 })],
    [9, 9, format('results.best', { n: 9 })],
    [4, 9, format('results.best', { n: 9 })],
  ])('score %s with best %s', (score, best, expected) => {
    expect(bestNote(score, best)).toBe(expected)
  })
})

test('shareText puts the colour-free grid on its own line', () => {
  const text = shareText('category-escape', 7, { tiles: '🟩🟥', text: '✓ ✗' }, 1, 6)

  expect(text).toBe(`${format('results.share', { game: en['game.name.category-escape'], n: 7, tiles: '🟩🟥', score: 1, max: 6 })}\n✓ ✗`)
})

test('the score axes use the deciding judge’s threshold', () => {
  expect(thresholdFor('device', 'gemma-4')).toBe(judgeConfig.passThreshold.device)
  expect(thresholdFor('cloud', 'gemma-4')).toBe(judgeConfig.passThreshold['gemma-4'])
  expect(thresholdFor(undefined, 'clef-flash')).toBe(judgeConfig.passThreshold['clef-flash'])
})
