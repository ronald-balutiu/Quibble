import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { gameIds, type GameId } from '@shared/games'
import { usePageMeta } from '@/app/use-page-meta'
import { DeviceJudgeCard } from '@/components/JudgeSetup/DeviceJudgeCard'
import { CloudModelChoice } from '@/components/JudgeSetup/CloudModelChoice'
import { en, format } from '@/copy/en'
import { usePuzzleIndex } from '@/lib/use-puzzle-index'
import { progressChanges, resetPuzzle } from '@/lib/storage/progress'
import { libraryEntries, maxFor, progressText, type statusOf } from './library-model'
import { GameRules } from './GameRules'
import '../scenes.css'

const FILTERS = ['all', 'easy', 'hard', 'unplayed'] as const
type Filter = (typeof FILTERS)[number]

export function LibraryScene() {
  usePageMeta(en['meta.title.library'])
  const [params, setParams] = useSearchParams()
  const game = gameIds.find((id) => id === params.get('game')) ?? 'oddly-specific'
  const { data: index, retry } = usePuzzleIndex()
  const revision = useSyncExternalStore(progressChanges.subscribe, progressChanges.snapshot)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the revision invalidates derived storage data after local or cross-tab changes.
  const entries = useMemo(() => index ? libraryEntries(index) : undefined, [index, revision])
  const [open, setOpen] = useState<number | undefined>()
  const [filter, setFilter] = useState<Filter>('all')
  const navigate = useNavigate()

  const puzzles = index?.[game] ?? []
  const statuses = entries?.[game] ?? []
  const solved = statuses.filter(({ status }) => status === 'solved' || status === 'perfect').length
  const continuing = statuses.find(({ status }) => status === 'open')
  const unplayed = statuses.filter(({ status }) => status === 'unplayed')
  const shown = statuses.filter((entry) => filter === 'all' || (filter === 'unplayed' ? entry.status === 'unplayed' : entry.difficulty === filter))
  const starter = unplayed[0]
  const summaries = gameIds.map((id) => ({
    id,
    count: index?.[id]?.length ?? 0,
    done: (entries?.[id] ?? []).filter(({ best }) => best !== undefined).length,
  }))
  const hasCompleted = summaries.some(({ done }) => done > 0)

  return (
    <main className="app-frame scene" data-scene="library">
      <div className="library-heading">
        <p className="telemetry">{en['library.title']}</p>
        <p className="telemetry">{format('library.solved', { solved, total: puzzles.length })}</p>
      </div>
      {/* Phone: game rows and judge choice above the selector. Desktop: sidebar beside it. */}
      <div className="library-layout">
      <nav className="game-rows" aria-label={en['home.games']}>
        {summaries.map(({ id, count, done }) => (
            <button key={id} type="button" className="game-row" data-game={id} aria-current={id === game ? 'page' : undefined} onClick={() => { if (id !== game) setParams({ game: id }) }}>
              <span className="telemetry">{en[`game.code.${id}`]}</span>
              <span className="game-row__name">{en[`game.name.${id}`]}</span>
              <span className="muted game-row__tagline">{en[`game.tagline.${id}`]}</span>
              <span className="telemetry">{count === 0 ? en['library.new'] : format('library.progress', { solved: String(done).padStart(3, '0'), total: String(count).padStart(3, '0') })}</span>
            </button>
        ))}
      </nav>
      <div className="library-setup">
        <section className="judge-card cloud-judge" aria-label={en['welcome.cloud.title']}><CloudModelChoice /></section>
        <DeviceJudgeCard />
      </div>
      <section className="library" data-game={game}>
        <h1 className="library__title">{en[`game.name.${game}`]}</h1>
        {(continuing || starter) && (
          <div className="library-start">
            <p>{en[continuing ? 'library.continue.note' : hasCompleted ? 'library.next.note' : 'library.start.note']}</p>
            {continuing
              ? <Link className="pill control-link" to={`/play/${game}/${String(continuing.n)}`}>{progressText(game, 'library.continue', { n: String(continuing.n).padStart(3, '0'), round: continuing.round ?? 1 })}</Link>
              : starter && <Link className="pill control-link" to={`/play/${game}/${String(starter.n)}`}>{format('library.start', { n: String(starter.n).padStart(3, '0'), difficulty: en[`difficulty.${starter.difficulty}`] })}</Link>}
          </div>
        )}
        <GameRules game={game} key={game} />
        <section className="library-puzzles" aria-labelledby="library-grid-title">
        <h2 id="library-grid-title">{en['library.gridTitle']}</h2>
        <p className="library-mobile-hint">{en['library.mobileHint']}</p>
        <div className="filters" role="group" aria-label={en['library.filters']}>
          {FILTERS.map((option) => (
            <button key={option} type="button" className="filter" aria-pressed={filter === option} onClick={() => { setFilter(option) }}>{en[`library.filter.${option}`]}</button>
          ))}
          {unplayed.length > 0 && <button type="button" className="setup-link library-shuffle" onClick={() => {
            const pick = unplayed[Math.floor(Math.random() * unplayed.length)]
            if (pick) void navigate(`/play/${game}/${String(pick.n)}`)
          }}>{en['library.shuffle']}</button>}
        </div>
        <p className="telemetry">{format('library.counts', { solved, open: statuses.filter(({ status }) => status === 'open').length, perfect: statuses.filter(({ status }) => status === 'perfect').length })}</p>
        {index === undefined && <p role="status">{en['library.loading']}</p>}
        {index === null && <div><p role="status">{en['library.unavailable']}</p><button type="button" className="pill pill--quiet" onClick={retry}>{en['action.retry']}</button></div>}
        {index && puzzles.length === 0 && <p>{en['library.empty']}</p>}
        <ol className="tiles">
          {shown.map(({ n, difficulty, status, best, progress }) => (
            <li key={n}>
              {/* The name starts with the visible number, so speech input can say it (WCAG 2.5.3). */}
              <button type="button" className={`tile tile--${status}`} onClick={() => {
                if (status === 'unplayed') void navigate(`/play/${game}/${String(n)}`)
                else setOpen(n)
              }}>
                <span className="tile__top">
                  <span className="tile__n">{String(n).padStart(3, '0')}</span>
                  {(status === 'solved' || status === 'perfect') && <span className="tile__check" aria-hidden="true">{en['library.completedMark']}</span>}
                </span>
                {progress
                  ? <>
                      <progress className="tile__progress" value={progress.done} max={progress.total} aria-hidden="true" />
                      <span className="visually-hidden">{format(game === 'category-escape' ? 'library.levelProgress' : 'library.roundProgress', progress)}</span>
                    </>
                  : <span className="tile__score">{status === 'perfect' ? en['library.perfectMark'] : best}</span>}
                <span className="visually-hidden">{format('library.tile', { difficulty: en[`difficulty.${difficulty}`], status: format(`library.status.${status}`, { best: best ?? 0, max: maxFor(game) }) })}</span>
              </button>
            </li>
          ))}
        </ol>
        </section>
      </section>
      </div>
      {open !== undefined && <PuzzleSheet game={game} n={open} saved={statuses.find(({ n }) => n === open)} onClose={() => { setOpen(undefined) }} />}
    </main>
  )
}

// L2: play, resume, replay or reset one puzzle. Reset asks once more in place (D-28).
function PuzzleSheet({ game, n, saved, onClose }: { game: GameId, n: number, saved: ReturnType<typeof statusOf> | undefined, onClose: () => void }) {
  const { status = 'unplayed', round } = saved ?? {}
  const [confirming, setConfirming] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const dialog = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    dialog.current?.showModal()
    return () => { clearTimeout(timer.current) }
  }, [])

  function reset() {
    if (!confirming) {
      setConfirming(true)
      timer.current = setTimeout(() => { setConfirming(false) }, 5000)
      return
    }
    resetPuzzle(game, n)
    onClose()
  }

  return (
    <dialog ref={dialog} className="sheet" onClose={onClose} aria-labelledby="sheet-title">
      <h2 id="sheet-title">{format('game.header', { code: en[`game.code.${game}`], n: String(n).padStart(3, '0') })}</h2>
      <div className="actions">
        <button type="button" className="pill" onClick={() => { void navigate(`/play/${game}/${String(n)}`) }}>
          {status === 'open' ? progressText(game, 'sheet.resume', { round: round ?? 1 }) : en['sheet.play']}
        </button>
        {status !== 'unplayed' && (
          <button type="button" className="pill pill--quiet" onClick={reset}>{confirming ? en['confirm.again'] : en['sheet.reset']}</button>
        )}
        <button type="button" className="pill pill--quiet" onClick={onClose}>{en['sheet.close']}</button>
      </div>
    </dialog>
  )
}
