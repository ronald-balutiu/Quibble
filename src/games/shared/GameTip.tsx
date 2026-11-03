import { useState } from 'react'
import type { GameId } from '@shared/games'
import { en, type CopyKey } from '@/copy/en'
import { markTipSeen, tipSeen } from '@/lib/storage/settings'

export function GameTip({ game, copy }: { game: GameId, copy: CopyKey }) {
  const [visible, setVisible] = useState(() => !tipSeen(game))
  if (!visible) return null
  return (
    <aside className="tip">
      <span>{en[copy]}</span>
      <button type="button" className="pill pill--quiet" onClick={() => { markTipSeen(game); setVisible(false) }}>{en['tip.dismiss']}</button>
    </aside>
  )
}
