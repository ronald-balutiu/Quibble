import type { ReactNode } from 'react'
import type { GameId } from '@shared/games'
import { en, format, puzzleNumber } from '@/copy/en'

// The game screen's header (5.5 G1–G7): the puzzle code, its status and the strike dots.

// `statusClass` lets a screen hide its status on phone, where its mock has none.
export function GameHeader({ game, n, status, statusClass, children }: { game: GameId, n: number, status: string, statusClass?: string | undefined, children: ReactNode }) {
  return (
    <header className="game-header">
      <span className="game-header__code">{format('game.header', { code: en[`game.code.${game}`], n: puzzleNumber(n) })}</span>
      <span className={statusClass ? `telemetry ${statusClass}` : 'telemetry'}>{status}</span>
      {children}
    </header>
  )
}

export function StrikeDots({ used, max }: { used: number, max: number }) {
  return (
    <span className="strikes" role="img" aria-label={format('game.strikes', { used, max })}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < used ? 'strikes__dot strikes__dot--used' : 'strikes__dot'} />)}
    </span>
  )
}
