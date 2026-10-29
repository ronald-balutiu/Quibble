import { describe, expect, test } from 'vitest'
import { isValidAnswer, normalizeAnswer } from '@shared/normalize'

describe('normalizeAnswer', () => {
  test.each([
    ['  a Pocket   Knife! ', 'pocket knife'],
    ['"The Toaster."', 'toaster'],
    ['Ｓｐｏｏｎ', 'spoon'],
    ['an apple', 'apple'],
    ['the', 'the'],
    ["children's book", "children's book"],
    ['glasses', 'glasses'],
  ])('normalizes noun phrases: %j → %j', (input, expected) => {
    expect(normalizeAnswer(input, 'oddly-specific')).toBe(expected)
  })

  test('strips leading articles only for noun-phrase games', () => {
    expect(normalizeAnswer('The Toaster', 'category-escape')).toBe('toaster')
    expect(normalizeAnswer('a Charge', 'double-agent')).toBe('a charge')
  })

  test('applies the alias map after normalizing', () => {
    const aliases = new Map([['cell phone', 'mobile phone']])
    expect(normalizeAnswer('A Cell Phone', 'oddly-specific', aliases)).toBe('mobile phone')
  })
})

describe('isValidAnswer', () => {
  test('noun-phrase answers must be 1–40 characters', () => {
    expect(isValidAnswer('', 'oddly-specific')).toBe(false)
    expect(isValidAnswer('x'.repeat(40), 'oddly-specific')).toBe(true)
    expect(isValidAnswer('x'.repeat(41), 'category-escape')).toBe(false)
  })

  test.each([
    ['charge', true],
    ["o'clock", true],
    ['well-being', true],
    ['two words', false],
    ['-charge', false],
    ['abc1', false],
    ['x'.repeat(20), true],
    ['x'.repeat(21), false],
  ])('Double Agent single word %j → %s', (word, valid) => {
    expect(isValidAnswer(word, 'double-agent')).toBe(valid)
  })
})
