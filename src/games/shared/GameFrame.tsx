import type { ReactNode, RefObject } from 'react'
import type { GameId } from '@shared/games'
import { DeviceSetup } from '@/components/DeviceSetup/DeviceSetup'
import { en } from '@/copy/en'
import { CloudStrip } from './JudgesPanel'
import type { DeviceColumn } from './use-device-column'
import './game.css'

// Every game screen's frame (5.5 G1, S1–S3): the header, the on-device setup
// sheet, the resting-cloud and storage strips, and Turnstile's invisible widget,
// above the screen's own play, round-end or results view.
export function GameFrame({ game, header, column, storageOn, turnstile, children }: {
  game: GameId, header: ReactNode, column: DeviceColumn, storageOn: boolean, turnstile: RefObject<HTMLDivElement | null>, children: ReactNode
}) {
  return (
    <main data-scene="game" className="app-frame game-frame" data-game={game}>
      {header}
      {column.setupOpen && <DeviceSetup onClose={column.closeSetup} />}
      <CloudStrip column={column} />
      {!storageOn && <p className="strip" role="status">{en['storage.off']}</p>}
      <div ref={turnstile} className="turnstile" />
      {children}
    </main>
  )
}

// Retry for a reveal or a judge column that didn't answer, inline after its message.
export function RetryLink({ onClick }: { onClick: () => void }) {
  return <button type="button" className="link-button" onClick={onClick}>{en['action.retry']}</button>
}
