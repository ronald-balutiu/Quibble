import { describe, expect, test } from 'vitest'
import type { Comparison } from '@/lib/storage/comparisons'
import { yourGames } from '@/lib/your-games'

const record = (conditions: [boolean, boolean][], extra: Partial<Comparison> = {}): Comparison => ({
  at: 1, game: 'oddly-specific', n: 1, round: 'r1', answer: 'x',
  conditions: Object.fromEntries(conditions.map(([cloudPass, devicePass], i) => [`c${String(i)}`, { cloud: 0.5, cloudPass, device: 0.5, devicePass }])),
  cloudModel: 'clef-flash', cloudMs: 300, cloudModelMs: 40, deviceMs: 120, backend: 'webgpu', precision: 'q4',
  warm: true, referee: 'cloud', overruled: false, ...extra,
})

describe('Your games (5.5 H3)', () => {
  test('counts agreement per guess and per condition, the stricter judge, overrules and warm speed', () => {
    const stats = yourGames([
      record([[true, true], [true, true]], { cloudModelMs: 30, deviceMs: 100 }),
      record([[false, true], [true, true]], { overruled: true }),
      record([[true, false], [false, true]], { referee: 'device', overruled: true, cloudModelMs: 50, deviceMs: 140 }),
      record([[true, true]], { warm: false, deviceMs: 900 }),
    ])
    expect(stats).toEqual({
      guesses: 4, agreedGuesses: 2, conditions: 7, agreedConditions: 4, splits: 3, cloudStricter: 2, deviceStricter: 1,
      overruled: { cloud: 1, device: 1 }, cloudMedianMs: 40, deviceMedianMs: 120,
    })
  })

  test('empty history has no speeds', () => {
    expect(yourGames([])).toMatchObject({ guesses: 0, cloudMedianMs: undefined, deviceMedianMs: undefined })
  })
})

describe('one puzzle on its results screen (G6)', () => {
  test('counts this run\'s compared guesses once each, and lists the splits', async () => {
    const { puzzleComparisons } = await import('@/lib/your-games')
    const records = [
      record([[true, true]], { answer: 'a', at: 1 }),
      record([[false, true]], { answer: 'a', at: 2 }), // a Retry of the same guess: the latest counts
      record([[true, true]], { answer: 'b' }),
      record([[true, false]], { answer: 'c', n: 2 }), // another puzzle
    ]
    const result = puzzleComparisons(records, 'oddly-specific', 1, new Set(['r1:a', 'r1:b']))
    expect(result).toMatchObject({ compared: 2, agreed: 1 })
    expect(result.splits).toEqual([{ record: records[1], condition: 'c0', cloud: 0.5, device: 0.5 }])
  })
})
