import { expect, test } from 'vitest'
import { libraryPath, puzzlePath } from '@/lib/paths'
import { en, pointsLabel, tryLabel } from '@/copy/en'

test('route paths match the route tree', () => {
  expect(puzzlePath('double-agent', 7)).toBe('/play/double-agent/7')
  expect(libraryPath('category-escape')).toBe('/play?game=category-escape')
  expect(libraryPath()).toBe('/play')
})

test('scoring labels name each try and count points', () => {
  expect([0, 1, 2, 3].map(tryLabel)).toEqual([
    en['rules.firstTry'],
    en['rules.secondTry'],
    en['rules.thirdTry'],
    en['rules.thirdTry'],
  ])
  expect([0, 1, 3].map(pointsLabel)).toEqual([en['rules.points'], en['rules.point'], en['rules.points']])
})
