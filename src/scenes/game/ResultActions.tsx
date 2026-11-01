import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Puzzle } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import { usePuzzleIndex } from '@/lib/use-puzzle-index'

interface ResultActionsProps {
  puzzle: Puzzle
  share: string
  restart?: { label: string, onClick: () => void }
  focusPrimary?: boolean
}

// The next puzzle and share feedback behave the same in every results screen.
export function ResultActions({ puzzle, share, restart, focusPrimary = false }: ResultActionsProps) {
  const index = usePuzzleIndex()
  const next = index?.[puzzle.game]?.find((entry) => entry.n > puzzle.n)
  const [copied, setCopied] = useState(false)
  const actions = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => { clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (focusPrimary) actions.current?.querySelector<HTMLElement>('a, button')?.focus()
  }, [focusPrimary, next])

  async function copy() {
    try {
      await navigator.clipboard.writeText(share)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => { setCopied(false) }, 2000)
    } catch {
      // Permission denied or clipboard unavailable: don't announce a successful copy.
    }
  }

  return (
    <>
      <div ref={actions} className="actions">
        {next && <Link className="pill control-link" to={`/play/${puzzle.game}/${String(next.n)}`}>{format('results.next', { n: String(next.n).padStart(3, '0'), difficulty: en[`difficulty.${next.difficulty}`] })}</Link>}
        {restart && <button type="button" className={next ? 'pill pill--quiet' : 'pill'} onClick={restart.onClick}>{restart.label}</button>}
        <button type="button" className="pill pill--quiet" onClick={() => { void copy() }}>{en['results.copy']}</button>
        {!restart && <Link className="pill pill--quiet control-link" to={`/play?game=${puzzle.game}`}>{en['nav.library']}</Link>}
      </div>
      <p role="status" className="telemetry">{copied ? en['toast.copied'] : ''}</p>
    </>
  )
}
