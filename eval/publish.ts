// Builds public/eval/results.json for the app (plan 3.10) from eval/history.json and
// eval/device-measurements.json. Calls no models. The test split is the single run
// on the final setup; development runs become the build-by-build story.
// Usage: npm run eval:publish
import { readFileSync, writeFileSync } from 'node:fs'
import { evalHistorySchema, type EvalRun } from '@shared/schemas/eval-history'
import { evalResultsSchema, resultsJudges, type EvalResults, type ResultsJudge } from '@shared/schemas/eval-results'

const history = evalHistorySchema.parse(JSON.parse(readFileSync('eval/history.json', 'utf8')))
const devices = JSON.parse(readFileSync('eval/device-measurements.json', 'utf8')) as unknown
const shown = (judge: string): judge is ResultsJudge => (resultsJudges as readonly string[]).includes(judge)

const tests = history.filter((run) => run.split === 'test')
const testCases = new Set(tests.map((run) => run.caseSetHash))
if (tests.length === 0 || testCases.size !== 1) throw new Error('Expected one test-set run on one case set.')
const judges: EvalResults['test']['judges'] = {}
for (const run of tests) {
  if (!shown(run.judge)) continue
  const { conditions, guesses, latencyMs, neuronsPerGuess } = run.metrics
  judges[run.judge] = {
    model: run.model, backend: run.backend, threshold: run.threshold,
    perCondition: conditions.accuracy, wholeGuess: guesses.accuracy,
    falseAcceptRate: guesses.falseAcceptRate, falseRejectRate: guesses.falseRejectRate,
    brier: conditions.brier, medianMs: latencyMs.median,
    ...(neuronsPerGuess === undefined ? {} : { neuronsPerGuess }),
  }
}

// One build per tuning change: development runs that share a note.
const builds: EvalResults['builds'] = []
for (const run of history.filter((r: EvalRun) => r.split === 'dev')) {
  let build = builds.find((b) => b.note === run.note)
  if (!build) {
    build = { build: builds.length + 1, date: run.date, note: run.note, wholeGuess: {} }
    builds.push(build)
  }
  if (shown(run.judge)) build.wholeGuess[run.judge] = run.metrics.guesses.accuracy.value
}

const results = evalResultsSchema.parse({
  target: { wholeGuess: 0.85, falseAcceptRate: 0.1 },
  test: { date: tests[0]?.date, cases: tests[0]?.n, judges },
  builds,
  devices,
})
writeFileSync('public/eval/results.json', `${JSON.stringify(results, null, 2)}\n`)
console.log(`public/eval/results.json: ${Object.keys(judges).join(', ')} on ${String(results.test.cases)} test cases; ${String(builds.length)} builds; ${String(results.devices.length)} device(s).`)
