import type { GameId } from '@shared/games'
import { en } from '@/copy/en'
import './game-example.css'

export function GameExample({ game }: { game: GameId }) {
  return (
    <div className="game-example">
      <ol>
        <li>{en[`welcome.${game}.example.1`]}</li>
        <li>{en[`welcome.${game}.example.2`]}</li>
        {game !== 'double-agent' && <li>{en[`welcome.${game}.example.3`]}</li>}
      </ol>
      <p>{en[`welcome.${game}.answer`]}</p>
    </div>
  )
}
