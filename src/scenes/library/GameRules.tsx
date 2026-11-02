import { gameConfigs, type GameId } from '@shared/games'
import { GameExample } from '@/components/GameExample/GameExample'
import { en } from '@/copy/en'

export function GameRules({ game }: { game: GameId }) {
  const config = gameConfigs[game]
  return (
    <details className="library-rules">
      <summary>{en['library.rules']}</summary>
      <div className="library-rules__body">
        <div className="library-rules__intro">
          <h2>{en[`welcome.${game}.title`]}</h2>
          <p>{en[`welcome.${game}.body`]}</p>
        </div>
        <div className="library-rules__layout">
          <GameExample game={game} worked />
          <section className="rules-scoring" aria-label={en['rules.scoring']}>
            <h3>{en['rules.scoring']}</h3>
            {'levels' in config
              ? <dl className="rules-scoring__facts">
                  <div><dt>{en['rules.perLevel']}</dt><dd><strong>{en['rules.onePoint']}</strong></dd></div>
                  <div><dt>{en['rules.forRun']}</dt><dd><strong>{config.maxWrongGuessesPerRun}</strong><span>{en['rules.wrongGuesses']}</span></dd></div>
                </dl>
              : <>
                  <dl className="rules-scoring__tries">
                    {config.pointsByGuess.map((points, i) => (
                      <div key={points}>
                        <dt>{en[i === 0 ? 'rules.firstTry' : i === 1 ? 'rules.secondTry' : 'rules.thirdTry']}</dt>
                        <dd><strong>{points}</strong><span>{en[points === 1 ? 'rules.point' : 'rules.points']}</span></dd>
                      </div>
                    ))}
                  </dl>
                  <p className="rules-scoring__note">{en['welcome.scoring.rounds.body']}</p>
                </>}
          </section>
        </div>
      </div>
    </details>
  )
}
