// The answer-key test (plan 3.10). Spends Workers AI allowance for cloud judges.
// Usage: npm run eval -- --judge clef-flash[,clef,gemma-4,device] --note "what changed"
//        [--split dev|test] [--final] [--no-save]
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { judgeConfig, passes } from '@shared/config'
import { answerKeySchema } from '@shared/schemas/answer-key'
import { evalHistorySchema, type EvalRun } from '@shared/schemas/eval-history'
import { AllowanceExhausted, loadJudge, type JudgeName } from './judges'
import { cohensKappa, computeMetrics, thresholdSweep, type CaseResult } from './metrics'

const historyPath = 'eval/history.json'
const judgeNames: readonly JudgeName[] = ['clef-flash', 'clef', 'gemma-4', 'device']

const { values } = parseArgs({
  options: {
    judge: { type: 'string', default: 'clef-flash' },
    split: { type: 'string', default: 'dev' },
    note: { type: 'string' },
    final: { type: 'boolean', default: false },
    'no-save': { type: 'boolean', default: false },
  },
})

const split = values.split
if (split !== 'dev' && split !== 'test') throw new Error('--split must be dev or test.')
const judges = values.judge.split(',').map((name) => {
  if (!judgeNames.includes(name as JudgeName)) throw new Error(`Unknown judge ${name}; use ${judgeNames.join(', ')}.`)
  return name as JudgeName
})
const note = values.note
if (!values['no-save'] && !note) throw new Error('Pass --note "what changed" so the history explains this run.')

const raw = readFileSync(`eval/${split}.json`, 'utf8')
const cases = answerKeySchema.parse(JSON.parse(raw))
const reviewed = cases.filter((c) => c.reviewed).length
if (split === 'test') {
  // The test split is run once, on the final setup, after every label is confirmed.
  if (!values.final) throw new Error('The test split runs once on the final setup; pass --final to confirm.')
  if (reviewed !== cases.length) throw new Error(`Only ${String(reviewed)} of ${String(cases.length)} test cases are reviewed.`)
}
const caseSetHash = createHash('sha256').update(raw).digest('hex')

const runs = new Map<JudgeName, { results: Map<string, CaseResult>, threshold: number, run: Omit<EvalRun, 'kappa'> }>()
const sweep = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
for (const name of judges) {
  const judge = await loadJudge(name)
  const results = new Map<string, CaseResult>()
  for (const [index, c] of cases.entries()) {
    try {
      results.set(c.id, await judge.score(c))
    } catch (error) {
      if (error instanceof AllowanceExhausted) {
        console.error(`${name}: daily allowance used up after ${String(index)} cases; nothing was saved. Rerun after 00:00 UTC.`)
        process.exit(1)
      }
      throw error
    }
    process.stdout.write(`\r${name}: ${String(index + 1)}/${String(cases.length)}`)
  }
  process.stdout.write('\n')

  const threshold = (name === 'device' ? judgeConfig.device : judgeConfig.cloud).passThreshold
  const metrics = computeMetrics(cases, results, threshold)
  runs.set(name, {
    results,
    threshold,
    run: {
      date: new Date().toISOString(), split, judge: name, model: judge.model, precision: judge.precision, backend: judge.backend,
      n: cases.length, reviewed, caseSetHash, threshold, note: note ?? 'not saved', metrics,
    },
  })

  const pct = (value: number) => `${(value * 100).toFixed(1)}%`
  const { conditions, guesses } = metrics
  console.log([
    `${name} on ${split} (${String(reviewed)}/${String(cases.length)} reviewed), pass threshold ${String(threshold)}`,
    `  whole guesses: ${pct(guesses.accuracy.value)} [${pct(guesses.accuracy.low)}–${pct(guesses.accuracy.high)}], n=${String(guesses.n)}`,
    `  false accepts: ${pct(guesses.falseAcceptRate.value)} of failing guesses; false rejects: ${pct(guesses.falseRejectRate.value)} of passing guesses`,
    `  conditions: ${pct(conditions.accuracy.value)}, n=${String(conditions.n)}; Brier ${conditions.brier.toFixed(3)}`,
    `  latency median ${metrics.latencyMs.median.toFixed(0)} ms, p95 ${metrics.latencyMs.p95.toFixed(0)} ms`
      + (metrics.neuronsPerGuess === undefined ? '' : `; ${metrics.neuronsPerGuess.toFixed(2)} Neurons per guess`),
  ].join('\n'))
  if (split === 'dev') {
    const wrong = cases.flatMap((c) => c.conditions
      .filter(({ id, expected }) => expected !== 'unsure' && passes(results.get(c.id)?.scores[id] ?? 0, threshold) !== (expected === 'yes'))
      .map(({ id, expected }) => `    ${c.id} "${c.answer}" ${id}: expected ${expected}, p=${(results.get(c.id)?.scores[id] ?? 0).toFixed(2)}`))
    if (wrong.length > 0) console.log(`  misjudged conditions:\n${wrong.join('\n')}`)
    console.log('  threshold sweep (whole-guess accuracy / false accepts / false rejects):')
    for (const row of thresholdSweep(cases, results, sweep)) {
      console.log(`    ${row.threshold.toFixed(1)}: ${pct(row.accuracy)} / ${pct(row.falseAcceptRate)} / ${pct(row.falseRejectRate)}`)
    }
  }
}

if (values['no-save']) process.exit(0)

const history = existsSync(historyPath) ? evalHistorySchema.parse(JSON.parse(readFileSync(historyPath, 'utf8'))) : []
for (const [name, { run }] of runs) {
  const kappa = Object.fromEntries([...runs].filter(([other]) => other !== name)
    .map(([other, { results, threshold: otherThreshold }]) => [other, Number(cohensKappa(cases, { results: runs.get(name)?.results ?? new Map(), threshold: runs.get(name)?.threshold ?? 0.5 }, { results, threshold: otherThreshold }).toFixed(4))]))
  history.push(Object.keys(kappa).length > 0 ? { ...run, kappa } : run)
}
writeFileSync(historyPath, `${JSON.stringify(evalHistorySchema.parse(history), null, 2)}\n`)
console.log(`Appended ${String(runs.size)} run(s) to ${historyPath}.`)
