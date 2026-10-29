import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { gameIds, type GameId } from '@shared/games'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import { cloudModels, type CloudModel } from '@shared/schemas/judge'
import type { PuzzleIndex } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import { maxScore } from '@/games/oddly-specific/reducer'
import { loadPuzzleIndex } from '@/lib/puzzles'
import { loadProgress, resetPuzzle } from '@/lib/storage/progress'
import { loadCloudModel, saveCloudModel } from '@/lib/storage/settings'
import '../scenes.css'

type Status = 'unplayed' | 'open' | 'solved' | 'perfect'

const max = maxScore(oddlySpecificConfig)

function statusOf(game: GameId, n: number): { status: Status, best?: number, round?: number } {
  const { best, run } = loadProgress(game, n)
  if (run) return { status: 'open', round: run.current + 1, ...(best === undefined ? {} : { best }) }
  if (best === undefined) return { status: 'unplayed' }
  return { status: best === max ? 'perfect' : 'solved', best }
}

export function LibraryScene() {
  const [params, setParams] = useSearchParams()
  const game = gameIds.find((id) => id === params.get('game')) ?? 'oddly-specific'
  const [index, setIndex] = useState<PuzzleIndex | null | undefined>(undefined)
  const [open, setOpen] = useState<number | undefined>()
  const [model, setModel] = useState<CloudModel>(loadCloudModel)
  const navigate = useNavigate()

  useEffect(() => { void loadPuzzleIndex().then((value) => { setIndex(value ?? null) }) }, [])

  const puzzles = index?.[game] ?? []
  const statuses = puzzles.map((entry) => ({ ...entry, ...statusOf(game, entry.n) }))
  const solved = statuses.filter(({ status }) => status === 'solved' || status === 'perfect').length
  const continuing = statuses.find(({ status }) => status === 'open')
  const unplayed = statuses.filter(({ status }) => status === 'unplayed')

  return (
    <main className="app-frame scene" data-scene="library">
      <header className="scene-header">
        <Link className="control-link" to="/" aria-label={en['nav.home']}>{en['app.name']}</Link>
        <span className="telemetry">{en['library.title']}</span>
      </header>
      <nav className="game-tabs" aria-label={en['home.games']}>
        {gameIds.map((id) => (
          <button key={id} type="button" className="game-tab" aria-current={id === game ? 'page' : undefined} onClick={() => { setParams({ game: id }) }}>
            <span className="telemetry">{en[`game.code.${id}`]}</span>
            <span>{en[`game.name.${id}`]}</span>
          </button>
        ))}
      </nav>
      <section className="library" data-game={game}>
        <p className="telemetry">{format('library.counts', { solved, open: continuing ? 1 : 0, perfect: statuses.filter(({ status }) => status === 'perfect').length })}</p>
        {index !== undefined && puzzles.length === 0 && <p>{en['library.empty']}</p>}
        <ol className="tiles">
          {statuses.map(({ n, difficulty, status, best }) => (
            <li key={n}>
              <button
                type="button" className={`tile tile--${status}`} onClick={() => { setOpen(n) }}
                aria-label={format('library.tile', { n, difficulty: en[`difficulty.${difficulty}`], status: format(`library.status.${status}`, { best: best ?? 0, max }) })}
              >
                <span className="tile__n">{String(n).padStart(3, '0')}</span>
                {best !== undefined && <span className="tile__score">{best}</span>}
              </button>
            </li>
          ))}
        </ol>
        <div className="actions">
          {continuing && <Link className="pill control-link" to={`/play/${game}/${String(continuing.n)}`}>{format('library.continue', { n: String(continuing.n).padStart(3, '0'), round: continuing.round ?? 1 })}</Link>}
          {unplayed.length > 0 && (
            <button type="button" className="pill pill--quiet" onClick={() => { const pick = unplayed[Math.floor(Math.random() * unplayed.length)]; if (pick) void navigate(`/play/${game}/${String(pick.n)}`) }}>
              {en['library.random']}
            </button>
          )}
        </div>
      </section>
      <fieldset className="judge-choice">
        <legend className="telemetry">{en['judgeChoice.title']}</legend>
        {cloudModels.map((option) => (
          <label key={option} className="judge-choice__option">
            <input type="radio" name="cloud-model" value={option} checked={model === option} onChange={() => { saveCloudModel(option); setModel(option) }} />
            <span>{en[`judgeChoice.${option}`]}</span>
            <span className="muted">{en[`judgeChoice.${option}.note`]}</span>
          </label>
        ))}
      </fieldset>
      {open !== undefined && <PuzzleSheet game={game} n={open} onClose={() => { setOpen(undefined) }} />}
    </main>
  )
}

// L2: play, resume, replay or reset one puzzle. Reset asks once more in place (D-28).
function PuzzleSheet({ game, n, onClose }: { game: GameId, n: number, onClose: () => void }) {
  const { status, round } = statusOf(game, n)
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
          {status === 'open' ? format('sheet.resume', { round: round ?? 1 }) : en['sheet.play']}
        </button>
        {status !== 'unplayed' && (
          <button type="button" className="pill pill--quiet" onClick={reset}>{confirming ? en['confirm.again'] : en['sheet.reset']}</button>
        )}
        <button type="button" className="pill pill--quiet" onClick={onClose}>{en['sheet.close']}</button>
      </div>
    </dialog>
  )
}
