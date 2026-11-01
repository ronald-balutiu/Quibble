import { useId, useState, type CSSProperties } from 'react'
import type { EvalResults } from '@shared/schemas/eval-results'
import { en, format } from '@/copy/en'
import { useEvalResults } from '@/lib/eval-results'
import { loadComparisons } from '@/lib/storage/comparisons'
import { loadCloudModel } from '@/lib/storage/settings'
import { yourGames, type YourGames } from '@/lib/your-games'
import './JudgesCompare.css'

// "How the judges compare" (1.7, 5.5 H1, H3): collapsed, three numbers; opened in
// place, the answer-key test (who is right) beside the player's own games (how often
// the judges agree). The same block sits under each results screen (G6).

const percent = (value: number) => format('compare.percent', { p: Math.round(value * 100) })
const ms = (value: number) => Math.round(value).toLocaleString()

export function JudgesCompare() {
  const [open, setOpen] = useState(false)
  const results = useEvalResults()
  const [mine] = useState(() => yourGames(loadComparisons()))
  const id = useId()
  const cloudModel = loadCloudModel()
  const cloud = results?.test.judges[cloudModel]
  const device = results?.test.judges.device

  return (
    <section className="compare" aria-labelledby={`${id}-title`}>
      <div className="compare__head">
        <h2 id={`${id}-title`} className="compare__title">{en['compare.title']}</h2>
        {open && (
          <p className="telemetry compare__legend">
            <span>{format('compare.legend.cloud', { model: en[`judgeChoice.${cloudModel}`] })}</span>
            <span>{format('compare.legend.device', { model: en['device.model'] })}</span>
          </p>
        )}
      </div>
      {results === null && <p>{en['compare.unavailable']}</p>}
      {open
        ? (
            <div id={`${id}-body`} className="compare__halves">
              {results && cloud && device && <AnswerKey results={results} cloud={cloud} device={device} cloudModel={cloudModel} />}
              <Yours mine={mine} />
            </div>
          )
        : (
            <dl id={`${id}-body`} className="compare__summary">
              {cloud && <Stat marker="dot" label={en['compare.cloudRight']} value={percent(cloud.wholeGuess.value)} />}
              {device && <Stat marker="ring" label={en['compare.deviceRight']} value={percent(device.wholeGuess.value)} />}
              {mine.guesses > 0 && <Stat marker="thin" label={en['compare.youAgreed']} value={percent(mine.agreedGuesses / mine.guesses)} />}
            </dl>
          )}
      <button type="button" className="compare__toggle telemetry" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => { setOpen(!open) }}>
        {en[open ? 'compare.close' : 'compare.open']}
      </button>
    </section>
  )
}

function Stat({ marker, label, value }: { marker: 'dot' | 'ring' | 'thin', label: string, value: string }) {
  return (
    <div className="compare__stat">
      <dt className="telemetry"><span className={`compare__marker compare__marker--${marker}`} aria-hidden="true" />{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

type JudgeResult = NonNullable<EvalResults['test']['judges']['device']>

function AnswerKey({ results, cloud, device, cloudModel }: { results: EvalResults, cloud: JudgeResult, device: JudgeResult, cloudModel: 'clef-flash' | 'gemma-4' }) {
  const rows = [
    { label: en['compare.perCondition'], note: '', cloud: cloud.perCondition.value, device: device.perCondition.value, text: percent },
    { label: en['compare.wholeGuess'], note: '', cloud: cloud.wholeGuess.value, device: device.wholeGuess.value, text: percent },
    { label: en['compare.falseAccepts'], note: en['compare.lowerBetter'], cloud: cloud.falseAcceptRate.value, device: device.falseAcceptRate.value, text: percent },
    { label: en['compare.falseRejects'], note: en['compare.lowerBetter'], cloud: cloud.falseRejectRate.value, device: device.falseRejectRate.value, text: percent },
    { label: en['compare.brier'], note: en['compare.brierScale'], cloud: cloud.brier, device: device.brier, text: (v: number) => String(Math.round(v * 100)) },
  ]
  // The change since the last build, for the chosen cloud judge.
  const builds = results.builds.filter((b) => b.wholeGuess[cloudModel] !== undefined)
  const [previous, last] = builds.slice(-2)
  const deviceSpeed = results.devices[0]?.warmGuessMedianMs
  return (
    <section className="compare__half" aria-labelledby="compare-key">
      <h3 id="compare-key" className="telemetry">{en['compare.key']}</h3>
      <p>{format('compare.key.body', { n: results.test.cases })}</p>
      <div className="compare__rows">
        {rows.map((row) => (
          <div key={row.label} className="compare__row">
            <span className="compare__label">{row.label}{row.note && <span className="telemetry">{row.note}</span>}</span>
            <span className="compare__bars" aria-hidden="true">
              {([['cloud', row.cloud], ['device', row.device]] as const).map(([judge, value]) => (
                // eslint-disable-next-line react/forbid-dom-props -- bar lengths are the measured results.
                <span key={judge} className={`compare__bar compare__bar--${judge}`} style={{ '--v': Math.min(1, value) } as CSSProperties}>
                  <span className="compare__fill" />
                  <span className="compare__mark" />
                </span>
              ))}
            </span>
            <span className="compare__values">
              <span>{format('compare.value.cloud', { v: row.text(row.cloud) })}</span>
              <span>{format('compare.value.device', { v: row.text(row.device) })}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="telemetry compare__foot">
        <span>{format('compare.speedCost', { cloud: ms(cloud.medianMs), device: deviceSpeed === undefined ? '–' : ms(deviceSpeed) })}</span>
        {previous && last && (
          <span>
            {format('compare.change', {
              build: last.build, previous: previous.build,
              delta: (Math.round(((last.wholeGuess[cloudModel] ?? 0) - (previous.wholeGuess[cloudModel] ?? 0)) * 1000) / 10).toLocaleString(undefined, { signDisplay: 'always' }),
            })}
          </span>
        )}
      </p>
    </section>
  )
}

function Yours({ mine }: { mine: YourGames }) {
  const stricter = mine.cloudStricter === mine.deviceStricter ? 'even' : mine.cloudStricter > mine.deviceStricter ? 'cloud' : 'device'
  return (
    <section className="compare__half" aria-labelledby="compare-yours">
      <h3 id="compare-yours" className="telemetry">{en['compare.yours']}</h3>
      {mine.guesses === 0
        ? <p>{en['compare.empty']}</p>
        : (
            <>
              <p>{format('compare.yours.body', { n: mine.guesses.toLocaleString() })}</p>
              <dl className="compare__cells">
                <div><dt className="telemetry">{en['compare.agreedGuess']}</dt><dd>{percent(mine.agreedGuesses / mine.guesses)}</dd></div>
                <div><dt className="telemetry">{en['compare.agreedCondition']}</dt><dd>{percent(mine.agreedConditions / Math.max(1, mine.conditions))}</dd></div>
                <div>
                  <dt className="telemetry">{en['compare.stricter']}</dt>
                  <dd>
                    {en[`compare.stricter.${stricter}`]}
                    {mine.splits > 0 && stricter !== 'even' && <span>{format('compare.stricter.splits', { n: Math.max(mine.cloudStricter, mine.deviceStricter), splits: mine.splits })}</span>}
                  </dd>
                </div>
                <div><dt className="telemetry">{en['compare.overruled']}</dt><dd>{format('compare.overruled.value', mine.overruled)}</dd></div>
              </dl>
              {mine.cloudMedianMs !== undefined && mine.deviceMedianMs !== undefined && (
                <div className="compare__speed">
                  <span className="telemetry">{en['compare.speed']}</span>
                  <span>{format('compare.speed.cloud', { ms: ms(mine.cloudMedianMs) })}</span>
                  <span>{format('compare.speed.device', { ms: ms(mine.deviceMedianMs) })} <span className="telemetry">{en['compare.speed.backend']}</span></span>
                </div>
              )}
            </>
          )}
    </section>
  )
}
