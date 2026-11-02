import type { GameId } from '@shared/games'
import { GameExample } from '@/components/GameExample/GameExample'
import { en } from '@/copy/en'

export function GameRules({ game }: { game: GameId }) {
  return (
    <details className="library-rules">
      <summary>{en['library.rules']}</summary>
      <div className="library-rules__body">
        <h2>{en[`welcome.${game}.title`]}</h2>
        <p>{en[`welcome.${game}.body`]}</p>
        <GameExample game={game} />
        {game === 'category-escape'
          ? <p>{en['welcome.scoring.escape.body']}</p>
          : <>
              <ul className="library-rules__points">
                <li>{en['welcome.scoring.first']}</li>
                <li>{en['welcome.scoring.second']}</li>
                <li>{en['welcome.scoring.third']}</li>
              </ul>
              <p>{en['welcome.scoring.rounds.body']}</p>
            </>}
      </div>
    </details>
  )
}
