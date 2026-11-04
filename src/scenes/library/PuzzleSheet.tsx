import { useNavigate } from 'react-router'
import type { GameId } from '@shared/games'
import { ConfirmButton } from '@/components/ConfirmButton/ConfirmButton'
import { en, format, puzzleNumber } from '@/copy/en'
import { puzzlePath } from '@/lib/paths'
import { resetPuzzle } from '@/lib/storage/progress'
import { useModalDialog } from '@/lib/use-modal-dialog'
import { progressText, type PuzzleStatus } from './library-model'

// L2: play, resume, replay or reset one puzzle. Reset asks once more in place (D-28).
export function PuzzleSheet({
  game,
  n,
  saved,
  onClose,
}: {
  game: GameId
  n: number
  saved: PuzzleStatus | undefined
  onClose: () => void
}) {
  const { status = 'unplayed', round } = saved ?? {}
  const dialog = useModalDialog()
  const navigate = useNavigate()

  return (
    <dialog ref={dialog} className="sheet" onClose={onClose} aria-labelledby="sheet-title">
      <h2 id="sheet-title">{format('game.header', { code: en[`game.code.${game}`], n: puzzleNumber(n) })}</h2>
      <div className="actions">
        <button
          type="button"
          className="pill"
          onClick={() => {
            void navigate(puzzlePath(game, n))
          }}
        >
          {status === 'open' ? progressText(game, 'sheet.resume', { round: round ?? 1 }) : en['sheet.play']}
        </button>
        {status !== 'unplayed' && (
          <ConfirmButton
            label={en['sheet.reset']}
            onConfirm={() => {
              resetPuzzle(game, n)
              onClose()
            }}
          />
        )}
        <button type="button" className="pill pill--quiet" onClick={onClose}>
          {en['sheet.close']}
        </button>
      </div>
    </dialog>
  )
}
