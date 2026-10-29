// Builds the prototype Oddly Specific library (Phase 2): the player-facing files in
// public/puzzles/ and the Worker library in worker/library/library.json.
// No model calls; it reads the truth matrix and confirmations.
// Usage: npm run ts -- factory/build-library.ts
import { mkdirSync } from 'node:fs'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import { normalizeAnswer } from '@shared/normalize'
import { puzzleIndexSchema, puzzleSchema, type Puzzle } from '@shared/schemas/puzzle'
import { librarySchema, type Library } from '../worker/library'
import { knownAnswers, oddlySpecificRounds, type Conditions } from './generators/rounds'
import { readJson, truth, writeJson, type Matrix } from './matrix'

interface ConditionEntry { label: string, negation: string, tag: string, question: string, claim: string, category?: boolean }

const MIN_KNOWN = 4 // plan 1.3: every Oddly Specific round has at least 4 known answers
const MAX_PUZZLES = 10 // Phase 2 needs 5–10 prototype puzzles
const things = readJson<string[]>('factory/things.json', [])
const conditions = readJson<Record<string, ConditionEntry>>('factory/conditions.json', {})
const matrix = readJson<Matrix>('factory/matrix.json', {})

// A condition true of most things barely narrows a round.
const yesShare = (id: string) => things.filter((thing) => truth(matrix[thing]?.[id]) === 'yes').length / things.length
const broad = new Set(Object.keys(conditions).filter((id) => yesShare(id) > 0.5))

// Rounds with enough confirmed known answers: those with fewer broad conditions
// first, then the easiest (most solutions). The prototype sample is small, so
// rounds with two broad conditions fill in after the better ones run out.
const broadCount = (ids: readonly string[]) => ids.filter((id) => broad.has(id)).length
const rounds = oddlySpecificRounds(matrix, things, conditions as Conditions)
  .map((round) => ({ ...round, known: knownAnswers(matrix, round.solutions, round.conditions) }))
  .filter((round) => round.known.length >= MIN_KNOWN && broadCount(round.conditions) <= 2)
  .sort((a, b) => broadCount(a.conditions) - broadCount(b.conditions) || b.solutions.length - a.solutions.length
    || a.conditions.join().localeCompare(b.conditions.join()))

for (const round of rounds) {
  for (const answer of round.known) {
    if (normalizeAnswer(answer, 'oddly-specific') !== answer) throw new Error(`Known answer "${answer}" changes under normalization.`)
  }
}

// Each puzzle takes the easiest unused rounds sharing at most one condition with
// each of its other rounds, so no two rounds in a puzzle are near-duplicates.
const overlap = (a: readonly string[], b: readonly string[]) => a.filter((id) => b.includes(id)).length
const perPuzzle = oddlySpecificConfig.rounds
const unused = [...rounds]
const assembled: (typeof rounds)[] = []
for (;;) {
  const chosen: typeof rounds = []
  for (const round of unused) {
    if (chosen.length === perPuzzle) break
    if (chosen.every((other) => overlap(other.conditions, round.conditions) <= 1)) chosen.push(round)
  }
  if (chosen.length < perPuzzle || assembled.length === MAX_PUZZLES) break
  for (const round of chosen) unused.splice(unused.indexOf(round), 1)
  assembled.push(chosen)
}
const count = assembled.length
const difficultyOf = (n: number) => (n <= Math.ceil(count / 3) ? 'easy' : n <= Math.ceil((2 * count) / 3) ? 'medium' : 'hard')

const puzzles: Puzzle[] = []
const library: Library = { puzzles: { 'oddly-specific': {} }, questions: {}, aliases: {} }
for (let n = 1; n <= count; n++) {
  const chosen = assembled[n - 1] ?? []
  const puzzle: Puzzle = {
    game: 'oddly-specific', n, difficulty: difficultyOf(n),
    rounds: chosen.map((round, i) => ({
      id: `r${String(i + 1)}`,
      conditions: round.conditions.map((id) => {
        const entry = conditions[id]
        if (!entry) throw new Error(`Unknown condition ${id}.`)
        return { id, label: entry.label, negation: entry.negation, claim: entry.claim }
      }),
    })),
  }
  puzzles.push(puzzleSchema.parse(puzzle))
  const lib = library.puzzles['oddly-specific']
  if (lib) {
    lib[String(n)] = {
      rounds: Object.fromEntries(chosen.map((round, i) => [`r${String(i + 1)}`, { conditions: round.conditions, known: round.known, example: round.known[0] ?? '' }])),
    }
  }
  for (const id of chosen.flatMap((round) => round.conditions)) library.questions[id] = conditions[id]?.question ?? ''
}

mkdirSync('public/puzzles/oddly-specific', { recursive: true })
for (const puzzle of puzzles) writeJson(`public/puzzles/oddly-specific/${String(puzzle.n)}.json`, puzzle)
writeJson('public/puzzles/index.json', puzzleIndexSchema.parse({ 'oddly-specific': puzzles.map(({ n, difficulty }) => ({ n, difficulty })) }))
writeJson('worker/library/library.json', librarySchema.parse(library))
console.log(`${String(puzzles.length)} Oddly Specific puzzles from ${String(rounds.length)} usable rounds (≥ ${String(MIN_KNOWN)} known answers, ≤ 2 broad conditions: ${[...broad].join(', ')}).`)
