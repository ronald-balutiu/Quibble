import { useId, useState } from 'react'
import type { EvalResults } from '@shared/schemas/eval-results'
import type { CloudModel } from '@shared/schemas/judge'
import { en, format } from '@/copy/en'
import { ComparisonTable } from './ComparisonTable'
import { dateLabel, milliseconds, percent } from './format'

type JudgeResult = NonNullable<EvalResults['test']['judges']['device']>

export function AnswerKey({ results, cloud, device, model }: { results: EvalResults, cloud: JudgeResult, device: JudgeResult, model: CloudModel }) {
  const [full, setFull] = useState(true)
  const id = useId()
  const cloudName = en[`judgeChoice.${model}`]
  const machine = results.devices[0]
  const rows = [
    { label: en['compare.perCondition'], note: en['compare.perCondition.note'], cloud: percent(cloud.perCondition.value), device: percent(device.perCondition.value) },
    { label: en['compare.falseAccepts'], note: en['compare.falseAccepts.note'], cloud: percent(cloud.falseAcceptRate.value), device: percent(device.falseAcceptRate.value) },
    { label: en['compare.falseRejects'], note: en['compare.falseRejects.note'], cloud: percent(cloud.falseRejectRate.value), device: percent(device.falseRejectRate.value) },
    { label: en['compare.brier'], note: en['compare.brierScale'], cloud: String(Math.round(cloud.brier * 100)), device: String(Math.round(device.brier * 100)) },
    { label: en['compare.speed'], note: en['compare.speed.note'], cloud: milliseconds(cloud.medianMs), device: milliseconds(machine?.warmGuessMedianMs) },
    { label: en['compare.cost'], note: en['compare.cost.note'], cloud: en['compare.free'], device: en['compare.free'] },
  ]

  return (
    <>
      <h3 className="compare__question">{en['compare.question']}</h3>
      <p className="compare__muted">{en['compare.wholeGuess']}</p>
      <dl className="compare__summary">
        {([{ name: en['compare.cloud'], model: cloudName, result: cloud }, { name: en['compare.local'], model: en['device.model'], result: device }]).map((judge) => (
          <div key={judge.name}>
            <dt>{judge.name}<strong>{judge.model}</strong></dt>
            <dd>{percent(judge.result.wholeGuess.value)}<small>{format('compare.correctCount', { n: Math.round(judge.result.wholeGuess.value * judge.result.wholeGuess.n), total: judge.result.wholeGuess.n })}</small></dd>
          </div>
        ))}
      </dl>
      <p className="compare__takeaway">{format(cloud.wholeGuess.value === device.wholeGuess.value ? 'compare.takeaway.tie' : 'compare.takeaway', {
        model: cloud.wholeGuess.value >= device.wholeGuess.value ? cloudName : en['device.model'],
        delta: (Math.abs(cloud.wholeGuess.value - device.wholeGuess.value) * 100).toFixed(1),
      })}</p>
      <button type="button" className="compare__toggle" aria-expanded={full} aria-controls={id} onClick={() => { setFull(!full) }}>
        {en[full ? 'compare.close' : 'compare.open']}
      </button>
      <div id={id} className="compare__details" hidden={!full}>
        <ComparisonTable label={en['compare.table']} cloudName={cloudName} rows={rows} />
        {machine && <p className="compare__footnote">{format('compare.timingContext', { browser: machine.browser, machine: machine.machine })}</p>}
        <DevelopmentBuilds results={results} model={model} />
        <details className="compare-disclosure">
          <summary>{en['compare.methods']}</summary>
          <p>{format('compare.methods.body', { n: results.test.cases, date: dateLabel(results.test.date) })}</p>
          <ul>
            <li>{format('compare.methods.guesses', { n: cloud.wholeGuess.n, excluded: results.test.cases - cloud.wholeGuess.n })}</li>
            <li>{format('compare.methods.rules', { n: cloud.perCondition.n, wrong: cloud.falseAcceptRate.n, right: cloud.falseRejectRate.n })}</li>
            <li>{en['compare.methods.backend']}</li>
          </ul>
          <h4>{en['compare.brier']}</h4><p>{en['compare.brier.body']}</p>
          <p>{format('compare.brier.raw', { cloud: cloudName, cloudScore: cloud.brier.toFixed(4), deviceScore: device.brier.toFixed(4) })}</p>
        </details>
      </div>
    </>
  )
}

function DevelopmentBuilds({ results, model }: { results: EvalResults, model: CloudModel }) {
  const builds = results.builds.filter((build) => build.wholeGuess[model] !== undefined)
  const [previous, last] = builds.slice(-2)
  if (!previous || !last) return null
  const delta = (((last.wholeGuess[model] ?? 0) - (previous.wholeGuess[model] ?? 0)) * 100).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'always' })
  return (
    <details className="compare-disclosure">
      <summary>{en['compare.builds']}<span>{format('compare.change', { build: last.build, previous: previous.build, delta })}</span></summary>
      <p>{en['compare.builds.note']}</p>
      <div className="compare__builds">{[previous, last].map((build) => (
        <div key={build.build}>
          <h4>{format('compare.build', { n: build.build, date: dateLabel(build.date) })}</h4>
          <p className="compare__build-score">{percent(build.wholeGuess[model] ?? 0)}</p>
          <p>{build.note}</p>
        </div>
      ))}</div>
    </details>
  )
}
