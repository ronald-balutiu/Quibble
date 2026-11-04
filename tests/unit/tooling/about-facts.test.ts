import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { gameIds } from '@shared/games'
import { answerKeySchema } from '@shared/schemas/answer-key'
import { evalResultsSchema } from '@shared/schemas/eval-results'
import { en } from '@/copy/en'
import { examples, factory, practiceGuesses, tableRows, tableRules, testKinds } from '@/scenes/about/about-facts'
import { librarySchema } from '../../../worker/library'

// The About page states these facts in prose and pictures; each must still match the
// files it was taken from.

const json = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))
const sealed = answerKeySchema.parse(json('eval/test.json'))
const results = evalResultsSchema.parse(json('public/eval/results.json'))
const library = librarySchema.parse(json('worker/library/library.json'))
// Each cell holds every model's probability; the last model to look has the final say.
const matrix = json('factory/matrix.json') as Record<
  string,
  Record<string, Partial<Record<'flash' | 'clef' | 'gemma', number>>>
>
const fits = (thing: string, rule: string) => {
  const cell = matrix[thing]?.[rule]
  return (cell?.gemma ?? cell?.clef ?? cell?.flash ?? 0) >= 0.5
}

describe('the About page facts', () => {
  test("the sealed test's kinds of guesses add up to the published test", () => {
    const counts = Object.fromEntries(testKinds)
    for (const kind of new Set(sealed.map((c) => c.kind)))
      expect(counts[kind], kind).toBe(sealed.filter((c) => c.kind === kind).length)
    expect(testKinds.reduce((sum, [, count]) => sum + count, 0)).toBe(results.test.cases)
  })

  test('the practice set is the dev split', () => {
    expect(answerKeySchema.parse(json('eval/dev.json'))).toHaveLength(practiceGuesses)
  })

  test('every judge leans strict, as the callout says', () => {
    for (const judge of Object.values(results.test.judges))
      expect(judge.falseRejectRate.value).toBeGreaterThan(judge.falseAcceptRate.value)
  })

  test("the truth table's size and slice match the factory", () => {
    expect(Math.round(Object.keys(matrix).length / 5) * 5).toBe(factory.things)
    expect(Object.keys(json('factory/conditions.json') as object)).toHaveLength(factory.rules)
    for (const { thing, fits: row } of tableRows)
      expect(
        tableRules.map((rule) => fits(en[`about.puzzles.thing.${thing}`], rule)),
        thing,
      ).toEqual([...row])
  })

  test('the spot-check read as many puzzles as the page says', () => {
    const report = readFileSync('factory/reports/spot-check.md', 'utf8')
    const sampled = [...report.matchAll(/^\| [A-Z][\w ]+ \| ([\d, ]+) \| \d+ \|$/gmu)].flatMap(([, list]) =>
      (list ?? '').split(','),
    )
    expect(sampled).toHaveLength(factory.spotChecked)
  })

  test("each game's example answers are real known answers", () => {
    for (const game of gameIds) {
      const { puzzle, steps } = examples[game]
      for (const { answer, round } of steps)
        expect(library.puzzles[game]?.[String(puzzle)]?.rounds[round]?.known, `${game} ${round}`).toContain(en[answer])
    }
  })
})
