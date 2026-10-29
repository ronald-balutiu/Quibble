import { expect, test } from 'vitest'
import { isCloseCall, judgeConfig, passes } from '@shared/config'

test('each judge passes at or above its own threshold', () => {
  const { passThreshold } = judgeConfig
  expect(passes(0.4, passThreshold['clef-flash'])).toBe(true)
  expect(passes(0.39, passThreshold['clef-flash'])).toBe(false)
  expect(passes(0.65, passThreshold.device)).toBe(false)
})

test('a close call sits within the margin of the deciding judge’s threshold', () => {
  const threshold = judgeConfig.passThreshold['clef-flash']
  expect(isCloseCall(0.25, threshold)).toBe(true)
  expect(isCloseCall(0.55, threshold)).toBe(true)
  expect(isCloseCall(0.2, threshold)).toBe(false)
  expect(isCloseCall(0.6, threshold)).toBe(false)
})
