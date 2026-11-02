import { describe, expect, test } from 'vitest'
import { clueClaim, clueQuestion } from '@shared/clues'

describe('Double Agent clue wording', () => {
  test('asks about everyday meanings, with the answer only as a placeholder in the claim', () => {
    expect(clueQuestion('a place that keeps money')).toBe("Can the word ordinarily mean: a place that keeps money? Judge the word's everyday meanings.")
    expect(clueClaim('a place that keeps money')).toBe('The word "{answer}" can ordinarily mean: a place that keeps money.')
  })
})
