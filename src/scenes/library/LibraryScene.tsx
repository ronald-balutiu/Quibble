import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { gameIds } from '@shared/games'
import { usePageMeta } from '@/app/use-page-meta'
import { DeviceJudgeCard } from '@/components/JudgeSetup/DeviceJudgeCard'
import { CloudModelChoice } from '@/components/JudgeSetup/CloudModelChoice'
import { en, format } from '@/copy/en'
import { usePuzzleIndex } from '@/lib/use-puzzle-index'
import { progressChanges } from '@/lib/storage/progress'
import { puzzlePath } from '@/lib/paths'
import { useHydrated } from '@/lib/use-hydrated'
import { useStorageRevision } from '@/lib/use-storage-revision'
import {
  filters,
  gameCounts,
  libraryEntries,
  matchesFilter,
  pickAtRandom,
  summarize,
  type Filter,
} from './library-model'
import { GameRows } from './GameRows'
import { GameRules } from './GameRules'
import { LibraryStart } from './LibraryStart'
import { PuzzleSheet } from './PuzzleSheet'
import { PuzzleTile } from './PuzzleTile'
import '../scenes.css'

// L1: the games, the judges, and one game's puzzles. Unplayed tiles start directly;
// played ones open the puzzle sheet (L2).
export function LibraryScene() {
  usePageMeta(en['meta.title.library'])
  const [params, setParams] = useSearchParams()
  // The prerendered Library shows the default game; ?game applies once hydrated.
  const hydrated = useHydrated()
  const game = (hydrated ? gameIds.find((id) => id === params.get('game')) : undefined) ?? 'oddly-specific'
  const { data: index, retry } = usePuzzleIndex()
  const revision = useStorageRevision(progressChanges)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the revision invalidates derived storage data after local or cross-tab changes.
  const entries = useMemo(() => (index ? libraryEntries(index) : undefined), [index, revision])
  const [open, setOpen] = useState<number | undefined>()
  const [filter, setFilter] = useState<Filter>('all')
  const navigate = useNavigate()

  const puzzles = index?.[game] ?? []
  const statuses = entries?.[game] ?? []
  const { solved, open: openRuns, perfect, continuing, unplayed } = summarize(statuses)
  const counts = gameCounts(index ?? undefined, entries)
  const hasCompleted = gameIds.some((id) => counts[id].played > 0)
  function shuffle() {
    const pick = pickAtRandom(unplayed)
    if (pick) void navigate(puzzlePath(game, pick.n))
  }

  return (
    <main className="app-frame scene" data-scene="library">
      <div className="library-heading">
        <p className="telemetry">{en['library.title']}</p>
        <p className="telemetry">{format('library.solved', { solved, total: puzzles.length })}</p>
      </div>
      {/* Phone: game rows and judge choice above the selector. Desktop: sidebar beside it. */}
      <div className="library-layout">
        <GameRows
          game={game}
          counts={counts}
          onSelect={(id) => {
            setParams({ game: id })
          }}
        />
        <div className="library-setup">
          <section className="judge-card cloud-judge" aria-label={en['welcome.cloud.title']}>
            <CloudModelChoice />
          </section>
          <DeviceJudgeCard />
        </div>
        <section className="library" data-game={game}>
          <h1 className="library__title">{en[`game.name.${game}`]}</h1>
          <LibraryStart game={game} continuing={continuing} starter={unplayed[0]} hasCompleted={hasCompleted} />
          <GameRules game={game} key={game} />
          <section className="library-puzzles" aria-labelledby="library-grid-title">
            <h2 id="library-grid-title">{en['library.gridTitle']}</h2>
            <p className="library-mobile-hint">{en['library.mobileHint']}</p>
            <div className="filters" role="group" aria-label={en['library.filters']}>
              {filters.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="filter"
                  aria-pressed={filter === option}
                  onClick={() => {
                    setFilter(option)
                  }}
                >
                  {en[`library.filter.${option}`]}
                </button>
              ))}
              {unplayed.length > 0 && (
                <button type="button" className="setup-link library-shuffle" onClick={shuffle}>
                  {en['library.shuffle']}
                </button>
              )}
            </div>
            <p className="telemetry">{format('library.counts', { solved, open: openRuns, perfect })}</p>
            {index === undefined && <p role="status">{en['library.loading']}</p>}
            {index === null && (
              <div>
                <p role="status">{en['library.unavailable']}</p>
                <button type="button" className="pill pill--quiet" onClick={retry}>
                  {en['action.retry']}
                </button>
              </div>
            )}
            {index && puzzles.length === 0 && <p>{en['library.empty']}</p>}
            <ol className="tiles">
              {statuses
                .filter((entry) => matchesFilter(entry, filter))
                .map((entry) => (
                  <li key={entry.n}>
                    <PuzzleTile
                      game={game}
                      entry={entry}
                      onSelect={() => {
                        if (entry.status === 'unplayed') void navigate(puzzlePath(game, entry.n))
                        else setOpen(entry.n)
                      }}
                    />
                  </li>
                ))}
            </ol>
          </section>
        </section>
      </div>
      {open !== undefined && (
        <PuzzleSheet
          game={game}
          n={open}
          saved={statuses.find(({ n }) => n === open)}
          onClose={() => {
            setOpen(undefined)
          }}
        />
      )}
    </main>
  )
}
