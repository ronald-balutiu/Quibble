import { expect, test } from 'vitest'
import { nextUtcMidnight } from '@shared/time'

test('nextUtcMidnight is the start of the next UTC day', () => {
  expect(nextUtcMidnight(new Date('2026-10-29T23:59:00Z'))).toBe('2026-10-30T00:00:00.000Z')
  expect(nextUtcMidnight(new Date('2026-12-31T00:00:00Z'))).toBe('2027-01-01T00:00:00.000Z')
})
