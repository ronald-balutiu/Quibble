// The Phase 3 factory run (plan 3.9; D-65, D-68, D-74). Resumable: every result is
// saved as it arrives, so rerunning continues where the last run stopped. All steps
// share one cap of 9,000 Neurons per UTC day, counted from factory/ledger.json.
//   1. matrix   Clef-flash scores every missing cell.
//   2. recheck  Gemma 4 re-checks cells Clef-flash scored 0.2–0.6.
//   3. confirm  Gemma 4 scores every yes cell, so known answers have two models.
//   4. agents   Double Agent words: Clef-flash checks the word against both clues,
//               that it is common and that the senses differ; survivors get 10
//               decoys per clue, then Gemma 4 confirms both clues.
// Then run factory/build-library.ts and npm run check-puzzles.
// Usage: npm run ts -- factory/run.ts [--dry-run] [--steps matrix,recheck,confirm,agents]
import { parseArgs } from 'node:util'
import { clueQuestion } from '@shared/clues'
import { isDailyAllowance, judgeWithClef, judgeWithGemma, type JudgeQuestion } from '../worker/judge'
import { readAnswers } from '../worker/read-answers'
import { candidate, loadWordNet, type Candidate } from './generators/double-agent'
import { seeded, shuffled } from './generators/rounds'
import { budgetedRunner, isUncertain, readJson, truth, writeJson, type LedgerEntry, type Matrix } from './matrix'
import { AllowanceExhausted, freeModels } from './workers-ai'

const DAILY_CAP = 9000 // D-65
// Measured Neurons per question in Phases 1–2, for the dry-run estimate.
const RATE = { flash: 0.32, gemma: 0.44 }
const YES = 0.6 // the Clef-flash yes bar (D-68)
const CONFIRMED = 0.85 // the known-answer margin (D-74)
const DECOYS = 10
const MAX_DECOYS = 2 // of 10: more and the clue is too vague
const MIN_SENSES = 4 // a loose first filter; Clef-flash judges commonness
const WORDS_WANTED = 330 // 100 puzzles × 3 rounds, plus 10% for the blocklist and spot-check

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, steps: { type: 'string', default: 'matrix,recheck,confirm,agents' } } })
const steps = new Set(values.steps.split(','))
const things = readJson<string[]>('factory/things.json', [])
const conditions = readJson<Record<string, { question: string }>>('factory/conditions.json', {})
const matrix = readJson<Matrix>('factory/matrix.json', {})
const ids = Object.keys(conditions)

const today = new Date().toISOString().slice(0, 10)
const spentToday = readJson<LedgerEntry[]>('factory/ledger.json', []).filter((entry) => entry.date.startsWith(today)).reduce((sum, entry) => sum + entry.neurons, 0)
const cap = Math.max(0, DAILY_CAP - spentToday)

// --- Matrix steps -----------------------------------------------------------

const cellsFor = {
  matrix: (thing: string) => ids.filter((id) => matrix[thing]?.[id] === undefined),
  recheck: (thing: string) => ids.filter((id) => { const cell = matrix[thing]?.[id]; return cell !== undefined && isUncertain(cell) }),
  confirm: (thing: string) => ids.filter((id) => { const cell = matrix[thing]?.[id]; return truth(cell) === 'yes' && cell?.gemma === undefined }),
}
const questions = (pending: string[]): JudgeQuestion[] => pending.map((id) => ({ id, question: conditions[id]?.question ?? '' }))

// --- Double Agent -----------------------------------------------------------

interface AgentCheck {
  word: string, clues: [string, string]
  first?: { a: number, b: number, common: number, distinct: number }
  decoys?: [number, number] // decoys that fit each clue
  gemma?: [number, number]
  accepted?: boolean
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const decoyQuestion = (word: string, clue: string) => `Can the word "${word}" ordinarily mean: ${clue}? Judge the word's everyday meanings.`

function agentPool(): Candidate[] {
  const wordnet = loadWordNet('factory/wordnet/json')
  const senseCount = (word: string) => wordnet.senses.get(word)?.length ?? 0
  const pool = [...wordnet.senses.keys()].filter((word) => senseCount(word) >= MIN_SENSES)
  // Words with more senses tend to be more common, so they go first.
  return shuffled(pool, seeded(20261030)).sort((a, b) => senseCount(b) - senseCount(a))
    .map((word) => candidate(wordnet, word, DECOYS)).filter((c): c is Candidate => c !== undefined)
}

const accepted = (checks: AgentCheck[]) => checks.filter((check) => check.accepted).length
const next = (check: AgentCheck): 'first' | 'decoys' | 'gemma' | undefined => {
  if (check.accepted !== undefined) return undefined
  return !check.first ? 'first' : !check.decoys ? 'decoys' : 'gemma'
}

// --- Dry run ----------------------------------------------------------------

if (values['dry-run']) {
  const count = (step: keyof typeof cellsFor) => things.reduce((sum, thing) => sum + cellsFor[step](thing).length, 0)
  const matrixCells = count('matrix')
  // New cells: about 16% need a re-check and about 20% are yes (Phase 2 rates).
  const recheck = count('recheck') + Math.round(matrixCells * 0.16)
  const confirm = count('confirm') + Math.round(matrixCells * 0.2)
  const checks = readJson<AgentCheck[]>('factory/double-agent-checks.json', [])
  const words = Math.max(0, WORDS_WANTED - accepted(checks))
  // About 40% of candidates pass the first check and 80% of those the rest.
  const agents = { first: Math.round(words / 0.32) * 4, decoys: Math.round(words / 0.8) * 2 * DECOYS, gemma: words * 2 }
  const rows = [
    ['matrix', 'clef-flash', matrixCells, matrixCells * RATE.flash],
    ['recheck', 'gemma-4', recheck, recheck * RATE.gemma],
    ['confirm', 'gemma-4', confirm, confirm * RATE.gemma],
    ['agents: first check', 'clef-flash', agents.first, agents.first * RATE.flash],
    ['agents: decoys', 'clef-flash', agents.decoys, agents.decoys * RATE.flash],
    ['agents: confirm', 'gemma-4', agents.gemma, agents.gemma * RATE.gemma],
  ] as const
  for (const [step, model, n, neurons] of rows) console.log(`${step.padEnd(20)} ${model.padEnd(11)} ${String(n).padStart(6)} questions  ~${neurons.toFixed(0)} Neurons`)
  const total = rows.reduce((sum, row) => sum + row[3], 0)
  console.log(`Total ~${total.toFixed(0)} Neurons. Today (UTC ${today}) ${spentToday.toFixed(0)} are already spent, so this run may spend ${cap.toFixed(0)}.`)
  process.exit(0)
}

// --- Run --------------------------------------------------------------------

const budget = budgetedRunner(cap)
console.log(`Cap for today (UTC ${today}): ${cap.toFixed(0)} Neurons.`)

async function matrixStep(step: keyof typeof cellsFor) {
  for (const thing of things) {
    if (budget.exhausted) break
    const pending = cellsFor[step](thing)
    if (pending.length === 0) continue
    const verdict = step === 'matrix'
      ? await judgeWithClef(budget.ai, thing, questions(pending), { model: 'clef-flash' })
      : await judgeWithGemma(budget.ai, thing, questions(pending))
    if (!verdict.ok) {
      if (verdict.error === 'resting') throw new AllowanceExhausted('The daily Workers AI allowance is used up.')
      console.error(`${step}: could not judge "${thing}"; it will be retried on the next run.`)
      continue
    }
    const row = matrix[thing] ??= {}
    for (const [id, p] of Object.entries(verdict.scores)) {
      if (step === 'matrix') row[id] = { flash: p }
      else if (row[id]) row[id].gemma = p
    }
    writeJson('factory/matrix.json', matrix)
  }
}

async function agentsStep() {
  const checks = readJson<AgentCheck[]>('factory/double-agent-checks.json', [])
  const byWord = new Map(checks.map((check) => [check.word, check]))
  for (const c of agentPool()) {
    if (budget.exhausted || accepted(checks) >= WORDS_WANTED) break
    let check = byWord.get(c.word)
    if (!check) {
      check = { word: c.word, clues: [capitalized(c.clues[0]?.clue ?? ''), capitalized(c.clues[1]?.clue ?? '')] }
      checks.push(check)
      byWord.set(c.word, check)
    }
    const [a, b] = check.clues
    while (next(check) && !budget.exhausted) {
      const stage = next(check)
      if (stage === 'first') {
        const verdict = await judgeWithClef(budget.ai, check.word, [
          { id: 'a', question: clueQuestion(a) },
          { id: 'b', question: clueQuestion(b) },
          { id: 'common', question: 'Is the word a common everyday English word that most adults know and use? Judge ordinary usage.' },
          { id: 'distinct', question: `Does the word have these two clearly different meanings, rather than one idea used in two settings? Meaning 1: ${a}. Meaning 2: ${b}.` },
        ], { model: 'clef-flash' })
        if (!verdict.ok) { if (verdict.error === 'resting') throw new AllowanceExhausted('The daily Workers AI allowance is used up.'); break }
        const s = verdict.scores
        check.first = { a: s.a ?? 0, b: s.b ?? 0, common: s.common ?? 0, distinct: s.distinct ?? 0 }
        if (Object.values(check.first).some((p) => p < YES)) check.accepted = false
      } else if (stage === 'decoys') {
        const fitting: number[] = []
        for (const [side, clue] of [a, b].entries()) {
          const words = c.clues[side]?.decoys ?? []
          const qs = Object.fromEntries(words.map((word, i) => [`d${String(i)}`, { type: 'noul', instructions: decoyQuestion(word, clue) }]))
          let response: unknown
          try {
            response = await budget.ai.run(freeModels['clef-flash'], { model: 'clef-flash', state: { game: 'word game', clue }, questions: qs })
          } catch (error) {
            if (isDailyAllowance(error)) throw new AllowanceExhausted('The daily Workers AI allowance is used up.')
            throw error
          }
          const read = readAnswers(response, 'clef-flash', Object.keys(qs))
          if (!read.ok) throw new Error(`Unreadable decoy check for "${check.word}".`)
          fitting.push(Object.values(read.scores).filter((p) => p >= YES).length)
        }
        check.decoys = [fitting[0] ?? 0, fitting[1] ?? 0]
        if (check.decoys.some((n) => n > MAX_DECOYS)) check.accepted = false
      } else {
        const verdict = await judgeWithGemma(budget.ai, check.word, [{ id: 'a', question: clueQuestion(a) }, { id: 'b', question: clueQuestion(b) }])
        if (!verdict.ok) { if (verdict.error === 'resting') throw new AllowanceExhausted('The daily Workers AI allowance is used up.'); break }
        check.gemma = [verdict.scores.a ?? 0, verdict.scores.b ?? 0]
        check.accepted = check.gemma.every((p) => p >= CONFIRMED)
      }
      writeJson('factory/double-agent-checks.json', checks)
    }
  }

  // The word list the library builder reads, clearest first (easy to hard).
  const clarity = (check: AgentCheck) => Math.min(...(check.gemma ?? [0])) * (check.first?.common ?? 0)
  if (accepted(checks) > 0) writeJson('factory/double-agent.json', checks.filter((check) => check.accepted).sort((x, y) => clarity(y) - clarity(x))
    .map(({ word, clues }) => ({ word, clues })))
  console.log(`agents: ${String(accepted(checks))} words accepted of ${String(checks.filter((check) => check.accepted !== undefined).length)} checked.`)
}

try {
  for (const step of ['matrix', 'recheck', 'confirm'] as const) {
    if (!steps.has(step) || budget.exhausted) continue
    await matrixStep(step)
    console.log(`${step}: ${budget.spent.toFixed(1)} Neurons`)
    budget.record(step, step === 'matrix' ? 'clef-flash' : 'gemma-4')
  }
  if (steps.has('agents') && !budget.exhausted) {
    await agentsStep()
    console.log(`agents: ${budget.spent.toFixed(1)} Neurons`)
    budget.record('agents', 'clef-flash+gemma-4')
  }
} catch (error) {
  budget.record('interrupted', 'mixed')
  throw error
}
const cells = Object.values(matrix).flatMap((row) => Object.values(row))
const counts = { yes: 0, no: 0, unknown: 0 }
for (const cell of cells) counts[truth(cell)] += 1
console.log(`${String(cells.length)} cells: ${String(counts.yes)} yes, ${String(counts.no)} no, ${String(counts.unknown)} unknown${budget.exhausted ? ' (stopped at the daily cap)' : ''}.`)
