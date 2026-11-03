// The app's answer-key numbers (public/eval/results.json, plan 3.10), built from
// the eval history and the on-device measurements. Pure, so a test can check the
// committed file still matches its sources (tests/unit/tooling/eval.test.ts).
import type { EvalRun } from '@shared/schemas/eval-history'
import { evalResultsSchema, resultsJudges, type EvalResults, type ResultsJudge } from '@shared/schemas/eval-results'

const shown = (judge: string): judge is ResultsJudge => (resultsJudges as readonly string[]).includes(judge)

export function buildResults(history: readonly EvalRun[], devices: unknown): EvalResults {
  // The test split is the single run on the final setup.
  const tests = history.filter((run) => run.split === 'test')
  if (tests.length === 0 || new Set(tests.map((run) => run.caseSetHash)).size !== 1)
    throw new Error('Expected one test-set run on one case set.')
  const judges: EvalResults['test']['judges'] = {}
  for (const run of tests) {
    if (!shown(run.judge)) continue
    const { conditions, guesses, latencyMs, neuronsPerGuess } = run.metrics
    judges[run.judge] = {
      model: run.model,
      backend: run.backend,
      threshold: run.threshold,
      perCondition: conditions.accuracy,
      wholeGuess: guesses.accuracy,
      falseAcceptRate: guesses.falseAcceptRate,
      falseRejectRate: guesses.falseRejectRate,
      brier: conditions.brier,
      medianMs: latencyMs.median,
      ...(neuronsPerGuess === undefined ? {} : { neuronsPerGuess }),
    }
  }

  // Development runs are the build-by-build story: one build per tuning change,
  // that is, per run note.
  const builds: EvalResults['builds'] = []
  for (const run of history.filter((r) => r.split === 'dev')) {
    let build = builds.find((b) => b.note === run.note)
    if (!build) {
      build = { build: builds.length + 1, date: run.date, note: run.note, wholeGuess: {} }
      builds.push(build)
    }
    if (shown(run.judge)) build.wholeGuess[run.judge] = run.metrics.guesses.accuracy.value
  }

  return evalResultsSchema.parse({
    target: { wholeGuess: 0.85, falseAcceptRate: 0.1 },
    test: { date: tests[0]?.date, cases: tests[0]?.n, judges },
    builds,
    devices,
  })
}
