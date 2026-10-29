// Phase 1 Double Agent prototype (plan 3.9): checks both clues of a seeded sample
// of WordNet candidates with Clef-flash. A clue passes if the target word scores
// yes and at most MAX_DECOYS of its decoys do; otherwise it is too vague.
// With --rewrite, Gemma 4 first rewrites each WordNet definition once into a short
// plain clue, as the factory will.
// Usage: npm run ts -- factory/double-agent-prototype.ts [--sample 40] [--rewrite] [--max-neurons 700]
import { parseArgs } from 'node:util'
import { readAnswers } from '../worker/read-answers'
import { candidate, loadWordNet, type Candidate } from './generators/double-agent'
import { seeded, shuffled } from './generators/rounds'
import { budgetedRunner, writeJson } from './matrix'
import { AllowanceExhausted, freeModels } from './workers-ai'

const { values } = parseArgs({ options: { sample: { type: 'string', default: '40' }, rewrite: { type: 'boolean', default: false }, 'max-neurons': { type: 'string', default: '700' } } })
const MIN_SENSES = 5 // rough stand-in for "common": WordNet has no frequency data
const YES = 0.8
const MAX_DECOYS = 3

const wordnet = loadWordNet('factory/wordnet/json')
const pool = [...wordnet.senses.keys()]
  .filter((word) => (wordnet.senses.get(word)?.length ?? 0) >= MIN_SENSES)
  .map((word) => candidate(wordnet, word))
  .filter((c): c is Candidate => c !== undefined)
const sample = shuffled(pool, seeded(20261029)).slice(0, Number(values.sample))
const budget = budgetedRunner(Number(values['max-neurons']))

// One plain clue from a dictionary definition, never containing the word itself.
async function rewrite(word: string, definition: string): Promise<string | undefined> {
  const result = await budget.ai.run(freeModels['gemma-4'], {
    messages: [{ role: 'user', content: `Rewrite this dictionary definition of one sense of the word "${word}" as a short, plain clue of at most 10 words, the way a crossword would phrase it. Do not use the word "${word}" or any form of it. Reply with the clue only.\n\nDefinition: ${definition}` }],
    chat_template_kwargs: { enable_thinking: false },
    temperature: 0,
    max_completion_tokens: 40,
  }) as { choices?: { message?: { content?: string } }[] }
  const clue = result.choices?.[0]?.message?.content?.trim().replace(/^["']|["'.]$/gu, '')
  return clue && !new RegExp(word.slice(0, Math.max(4, word.length - 2)), 'iu').test(clue) ? clue : undefined
}

const question = (word: string, clue: string) => `Can the word "${word}" ordinarily mean: ${clue}? Judge the word's everyday meanings.`

const results = []
try {
  for (const c of sample) {
    if (budget.exhausted) break
    const clues = []
    for (const { clue: definition, domain, decoys } of c.clues) {
      const clue = values.rewrite ? await rewrite(c.word, definition) ?? definition : definition
      const words = [c.word, ...decoys]
      const questions = Object.fromEntries(words.map((word, i) => [`w${String(i)}`, { type: 'noul', instructions: question(word, clue) }]))
      let response: unknown
      try {
        response = await budget.ai.run(freeModels['clef-flash'], { model: 'clef-flash', state: { game: 'word game', clue }, questions })
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('3036:')) throw new AllowanceExhausted(error.message)
        throw error
      }
      const read = readAnswers(response, 'clef-flash', Object.keys(questions))
      if (!read.ok) throw new Error(`Unreadable clue check for "${c.word}".`)
      const target = read.scores.w0 ?? 0
      const passingDecoys = decoys.filter((_, i) => (read.scores[`w${String(i + 1)}`] ?? 0) >= YES)
      clues.push({ domain, definition, clue, target, passingDecoys, decoyCount: decoys.length, ok: target >= YES && passingDecoys.length <= MAX_DECOYS })
    }
    results.push({ word: c.word, ok: clues.every((clue) => clue.ok), clues })
  }
} finally {
  budget.record(values.rewrite ? 'double-agent-rewrite-and-clues' : 'double-agent-clues', values.rewrite ? 'gemma-4+clef-flash' : 'clef-flash')
}

const checked = results.length
const valid = results.filter((r) => r.ok).length
const clueFailures = {
  targetFailed: results.flatMap((r) => r.clues).filter((clue) => clue.target < YES).length,
  tooVague: results.flatMap((r) => r.clues).filter((clue) => clue.target >= YES && clue.passingDecoys.length > MAX_DECOYS).length,
}
const summary = {
  rewritten: values.rewrite,
  pool: pool.length, minSenses: MIN_SENSES, checked, valid, yield: checked === 0 ? 0 : valid / checked,
  projectedWords: Math.round(pool.length * (checked === 0 ? 0 : valid / checked)), clueFailures, results,
}
writeJson(`factory/reports/prototype-double-agent${values.rewrite ? '-rewritten' : ''}.json`, summary)
console.log(JSON.stringify({ ...summary, results: undefined }, null, 1))
