import { expect, test } from 'vitest'
import { gameConfigs, gameIds, isGameId } from '@shared/games'

test('every game id names its own config', () => {
  expect(gameIds.map((id) => gameConfigs[id].id)).toEqual(gameIds)
})

test.each([
  ['oddly-specific', true],
  ['category-escape', true],
  ['double-agent', true],
  ['nope', false],
  ['toString', false],
  [undefined, false],
])('isGameId(%s) is %s', (value, expected) => {
  expect(isGameId(value)).toBe(expected)
})
