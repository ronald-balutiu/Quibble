import { categoryEscapeConfig } from '@shared/games/category-escape'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import { en } from '@/copy/en'

// "How scoring works" on Home, shown as example rounds: each row's tiles are the
// guesses (✗ a miss, ✓ accepted), and its text says the same, so the tiles stay
// decorative. Double Agent scores like Oddly Specific.

type Tile = 'pass' | 'miss' | 'open'

function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <span className="score-tiles" aria-hidden="true">
      {tiles.map((tile, i) => (
        <span key={i} className={`score-tile score-tile--${tile}`}>{tile === 'open' ? null : en[`welcome.scoring.mark.${tile}`]}</span>
      ))}
    </span>
  )
}

const tryLabels = ['rules.firstTry', 'rules.secondTry', 'rules.thirdTry'] as const
const misses = (count: number): Tile[] => Array.from({ length: count }, () => 'miss')
const points = (count: number) => en[count === 1 ? 'rules.point' : 'rules.points']

export function HowScoring() {
  const { pointsByGuess, maxWrongGuessesPerRound } = oddlySpecificConfig
  const { levels, maxWrongGuessesPerRun } = categoryEscapeConfig
  const cleared = Math.floor(levels / 2)
  return (
    <section className="welcome-section" aria-labelledby="welcome-scoring">
      <h2 id="welcome-scoring">{en['welcome.scoring']}</h2>
      <div className="welcome-scores">
        <div>
          <h3>{en['welcome.scoring.rounds']}</h3>
          <ol className="score-examples">
            {pointsByGuess.map((value, i) => (
              <li key={value}>
                <Tiles tiles={[...misses(i), 'pass']} />
                <span>{en[tryLabels[i] ?? 'rules.thirdTry']}</span>
                <span className="score-examples__value"><strong>{value}</strong> {points(value)}</span>
              </li>
            ))}
            <li>
              <Tiles tiles={misses(maxWrongGuessesPerRound)} />
              <span>{en['welcome.scoring.roundOver']}</span>
              <span className="score-examples__value"><strong>{0}</strong> {points(0)}</span>
            </li>
          </ol>
        </div>
        <div>
          <h3>{en['game.name.category-escape']}</h3>
          <ul className="score-examples">
            <li>
              <Tiles tiles={Array.from({ length: levels }, (_, i) => (i < cleared ? 'pass' : 'open'))} />
              <span>{en['rules.perLevel']}</span>
              <span className="score-examples__value"><strong>{1}</strong> {points(1)}</span>
            </li>
            <li>
              <Tiles tiles={misses(maxWrongGuessesPerRun)} />
              <span>{en['welcome.scoring.escape.misses']}</span>
              <span className="score-examples__value">{en['welcome.scoring.escape.over']}</span>
            </li>
          </ul>
        </div>
      </div>
      <p className="welcome-overrule">{en['welcome.overrule']}</p>
    </section>
  )
}
