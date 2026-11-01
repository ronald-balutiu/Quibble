import { useId, useState, useSyncExternalStore } from 'react'
import { cloudModels, type CloudModel } from '@shared/schemas/judge'
import { en, format } from '@/copy/en'
import { useEvalResults } from '@/lib/eval-results'
import { loadCloudModel, subscribeCloudModel } from '@/lib/storage/settings'
import { AnswerKey } from './AnswerKey'
import { YourGames } from './YourGames'
import { dateLabel } from './format'
import './JudgesCompare.css'

// Shared on Home and every results screen. Previewing another test model never
// changes the playing judge. Until then, follow the saved cloud choice live.
export function JudgesCompare({ collapsible = false }: { collapsible?: boolean }) {
  const [view, setView] = useState<'test' | 'games'>('test')
  const [preview, setPreview] = useState<CloudModel>()
  const chosen = useSyncExternalStore(subscribeCloudModel, loadCloudModel)
  const model = preview ?? chosen
  const results = useEvalResults()
  const cloud = results?.test.judges[model]
  const device = results?.test.judges.device
  const id = useId()

  const content = (
    <div className="compare__content">
      <div className="compare__sources" role="group" aria-label={en['compare.source']}>
        {(['test', 'games'] as const).map((source) => (
          <button type="button" key={source} aria-pressed={view === source} aria-controls={`${id}-panel`} onClick={() => { setView(source) }}>{en[`compare.source.${source}`]}</button>
        ))}
      </div>
      <div id={`${id}-panel`}>
        {view === 'games'
          ? <YourGames />
          : <>
              <div className="compare__toolbar">
                {results && <p className="compare__meta">{format('compare.testMeta', { n: results.test.cases, date: dateLabel(results.test.date) })}</p>}
                <label className="compare__model" htmlFor={`${id}-model`}>
                  {en['compare.model']}
                  <select id={`${id}-model`} value={model} onChange={(event) => { const next = cloudModels.find((m) => m === event.target.value); if (next) setPreview(next) }}>
                    {cloudModels.map((m) => <option key={m} value={m}>{en[`judgeChoice.${m}`]}</option>)}
                  </select>
                </label>
              </div>
              {results && cloud && device
                ? <AnswerKey results={results} cloud={cloud} device={device} model={model} />
                : <p role="status">{en[results === undefined ? 'compare.loading' : 'compare.unavailable']}</p>}
            </>}
      </div>
    </div>
  )

  return (
    <section className="compare" aria-labelledby={`${id}-title`}>
      <header className="compare__head">
        <h2 id={`${id}-title`}>{en['compare.title']}</h2>
        <p>{en['compare.intro']}</p>
      </header>
      {collapsible
        ? <details className="compare__disclosure"><summary>{en['compare.expand']}</summary>{content}</details>
        : content}
    </section>
  )
}
