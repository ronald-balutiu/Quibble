import { describe, expect, test } from 'vitest'
import { DEVICE_TOTAL_BYTES, fraction, megabytes, ringsDrawn, secondsLeft, tickState, TICKS } from '@/components/DeviceSetup/progress'

describe('S4 download readout (5.3)', () => {
  test('the total is the four model files, about 570 MB', () => {
    expect(DEVICE_TOTAL_BYTES).toBe(570_483_465)
    expect(megabytes(DEVICE_TOTAL_BYTES)).toBe(570)
  })

  test('progress stays within 0–1, and a ring is drawn per third', () => {
    expect(fraction(-5, 100)).toBe(0)
    expect(fraction(50, 100)).toBe(0.5)
    expect(fraction(150, 100)).toBe(1)
    expect(fraction(1, 0)).toBe(0)
    expect([0, 0.33, 0.34, 0.67, 0.99, 1].map(ringsDrawn)).toEqual([0, 0, 1, 2, 2, 3])
  })

  test('the tick strip marks passed ticks, the one being filled, and the rest', () => {
    expect(TICKS.map((tick) => tickState(tick, 46))).toEqual([
      'done', 'done', 'done', 'done', 'current', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo',
    ])
    expect(tickState(90, 100)).toBe('done')
    expect(tickState(100, 100)).toBe('current')
  })

  test('time left comes from the measured rate, once a second has passed', () => {
    const first = { at: 0, received: 0 }
    expect(secondsLeft(first, { at: 500, received: 10_000_000 }, 100_000_000)).toBeUndefined()
    expect(secondsLeft(first, { at: 2000, received: 0 }, 100_000_000)).toBeUndefined()
    // 20 MB in 2 s is 10 MB/s, so 80 MB left is 8 s.
    expect(secondsLeft(first, { at: 2000, received: 20_000_000 }, 100_000_000)).toBe(8)
    expect(secondsLeft(first, { at: 2000, received: 100_000_000 }, 100_000_000)).toBe(0)
  })
})
