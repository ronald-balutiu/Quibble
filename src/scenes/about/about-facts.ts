import type { GameId } from '@shared/games'
import type { CopyKey } from '@/copy/en'

// Facts the About page states that the published results don't carry: the sealed
// test's mix of guesses, the practice set's size, a slice of the factory's truth table
// and the puzzle spot-check. tests/unit/app/about-facts.test.ts checks each against
// its source (eval/, factory/ and worker/library/), so the page can't drift from them.

export const testKinds = [
  ['clear', 54],
  ['one-fail', 37],
  ['borderline', 22],
  ['multi-fail', 11],
  ['ambiguous', 10],
  ['misspelling', 4],
  ['gibberish', 3],
  ['instruction', 3],
  ['polysemy', 2],
] as const

export const practiceGuesses = 154

// Everyday things down the side, rules across the top, and the puzzles read by hand.
export const factory = { things: 235, rules: 60, spotChecked: 30 }

export const tableRules = ['pocket', 'drawer', 'pack'] as const
export const tableRows = [
  { thing: 'safety-pin', fits: [true, true, true] },
  { thing: 'pencil', fits: [true, true, true] },
  { thing: 'scissors', fits: [true, true, false] },
  { thing: 'printer', fits: [false, false, false] },
] as const

// One real known answer per step, from each game's first puzzle.
export const examples: Record<GameId, { puzzle: number; steps: { rules: CopyKey; answer: CopyKey; round: string }[] }> =
  {
    'oddly-specific': {
      puzzle: 1,
      steps: [{ rules: 'about.example.os', answer: 'about.example.os.answer', round: 'r1' }],
    },
    'category-escape': {
      puzzle: 1,
      steps: [
        { rules: 'about.example.ce.office', answer: 'about.example.ce.office.answer', round: 'L1' },
        { rules: 'about.example.ce.cheap', answer: 'about.example.ce.cheap.answer', round: 'L2' },
        { rules: 'about.example.ce.nonfood', answer: 'about.example.ce.nonfood.answer', round: 'L3' },
      ],
    },
    'double-agent': {
      puzzle: 1,
      steps: [{ rules: 'about.example.da', answer: 'about.example.da.answer', round: 'r1' }],
    },
  }
