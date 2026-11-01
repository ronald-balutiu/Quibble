import { useEffect, useRef, useState, type Dispatch } from 'react'
import type { Puzzle } from '@shared/schemas/puzzle'
import { totalScore, type RunAction, type RunState } from '@/games/rounds/reducer'
import { markOverruled } from '@/lib/storage/comparisons'
import { isStorageAvailable, loadProgress, saveRun } from '@/lib/storage/progress'
import { loadCloudModel, loadReferee } from '@/lib/storage/settings'
import { checkAnswer } from './check-answer'
import { judgeGuess, type Ui } from './judge-guess'
import { useDeviceColumn } from './use-device-column'

type GuessAction = Extract<RunAction, { type: 'judged' | 'moveOn' | 'countAnyway' }>
interface LastGuess { answer: string, level: number, pass: boolean, overruled?: boolean }

// The browser-side lifecycle shared by every game. Reducers still own scoring
// and progression; this hook owns judging, form state, focus and saving the run.
export function useGameSession(puzzle: Puzzle, run: RunState, dispatch: Dispatch<GuessAction>) {
  const { game, n } = puzzle
  const [ui, setUi] = useState<Ui>(() => {
    const round = run.rounds[run.current]
    const last = round?.pending ? round.guesses.at(-1) : undefined
    return last ? { kind: 'rejected', guess: last } : { kind: 'input' }
  })
  const [answer, setAnswer] = useState('')
  const [scores, setScores] = useState<Record<string, number | undefined>>({})
  const [last, setLast] = useState<LastGuess | undefined>()
  const [model] = useState(loadCloudModel)
  const [storageOn] = useState(isStorageAvailable)
  const [best, setBest] = useState(() => loadProgress(game, n).best)
  const attempt = useRef(0)
  const turnstile = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const column = useDeviceColumn()
  const busy = ui.kind === 'judging' || column.run?.kind === 'scanning'
  const score = totalScore(run)
  const advancesImmediately = game === 'category-escape'
  const roundIndex = run.current

  useEffect(() => { saveRun(game, n, run, score) }, [game, n, run, score])
  useEffect(() => {
    if (busy || run.finished) return
    input.current?.focus()
    if (ui.kind === 'rejected') input.current?.select()
  }, [roundIndex, run.finished, ui.kind, busy])

  async function judge() {
    if (busy) return
    const checked = checkAnswer(answer, game, run)
    if (checked.ui) {
      if (checked.ui.kind === 'rejected' || (checked.ui.kind === 'input' && checked.ui.notice === 'input.repeat')) column.clear()
      setUi(checked.ui)
      return
    }
    const { normalized } = checked
    attempt.current += 1
    setUi({ kind: 'judging' })
    setScores({})
    const round = puzzle.rounds[run.current]
    const result = await judgeGuess({
      game, n, roundId: round?.id ?? '', text: answer, normalized, attempt: attempt.current,
      model, conditions: round?.conditions ?? [], turnstile: turnstile.current,
    }, {
      referee: loadReferee(), onDevice: column.follow(),
      onCloud: (cloud, ms) => {
        setScores(cloud)
        setLast({ answer: normalized, level: run.current, pass: false })
        column.judged(ms)
      },
    })
    column.settled(result)
    if ('ui' in result) { setUi(result.ui); return }
    setLast({ answer: normalized, level: run.current, pass: result.guess.pass })
    dispatch({ type: 'judged', guess: result.guess })
    setUi(result.guess.pass ? { kind: 'input' } : { kind: 'rejected', guess: result.guess })
    if (result.guess.pass && advancesImmediately) setAnswer('')
  }

  function type(value: string) {
    // Moving on, including typing, is the only point a rejection costs a strike.
    if (ui.kind === 'rejected') { dispatch({ type: 'moveOn' }); setUi({ kind: 'input' }) }
    else if ((ui.kind === 'input' && ui.notice) || ui.kind === 'reused') setUi({ kind: 'input' })
    setAnswer(value)
  }

  function edit() {
    setUi({ kind: 'input' })
    input.current?.focus()
  }

  function tryAgain() {
    dispatch({ type: 'moveOn' })
    setAnswer('')
    edit()
  }

  function countAnyway() {
    if (ui.kind !== 'rejected' || busy) return
    markOverruled(game, n, puzzle.rounds[run.current]?.id ?? '', ui.guess.answer)
    setLast({ answer: ui.guess.answer, level: run.current, pass: true, overruled: true })
    dispatch({ type: 'countAnyway' })
    if (advancesImmediately) { setAnswer(''); setUi({ kind: 'input' }) }
  }

  function reset() {
    column.clear()
    setBest(loadProgress(game, n).best)
    setScores({})
    setLast(undefined)
    setAnswer('')
    setUi({ kind: 'input' })
  }

  return { ui, answer, scores, last, model, storageOn, best, turnstile, input, column, busy, judge, type, edit, tryAgain, countAnyway, reset }
}
