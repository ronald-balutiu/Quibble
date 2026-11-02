import type { GameId } from '@shared/games'
import { en, format } from '@/copy/en'
import './game-example.css'

export function GameExample({ game, worked = false }: { game: GameId, worked?: boolean }) {
  const steps = game === 'category-escape'
    ? ([1, 2, 3] as const).map((n) => ({ label: en[`example.escape.rule.${n}`], answer: en[`example.escape.answer.${n}`] }))
    : [
        { label: en[`welcome.${game}.example.1`] },
        { label: en[`welcome.${game}.example.2`] },
        ...(game === 'oddly-specific' ? [{ label: en['welcome.oddly-specific.example.3'] }] : []),
      ]
  const answer = game === 'category-escape' ? undefined : en[`example.${game}.answer`]
  if (worked) {
    return (
      <figure className="game-example game-example--worked" data-example={game}>
        <figcaption>{en['example.quick']}</figcaption>
        <ol className="game-example__steps">
          {steps.map((step, i) => (
            <li key={step.label}>
              <span className="game-example__number" aria-hidden="true">{i + 1}</span>
              <span>{step.label}</span>
              {'answer' in step && <strong className="game-example__step-answer">{step.answer}</strong>}
            </li>
          ))}
        </ol>
        {answer
          ? <div className="game-example__result"><span>{en[`example.result.${game === 'double-agent' ? 'both' : 'three'}`]}</span><strong>{answer}</strong></div>
          : <p className="game-example__carry">{en['welcome.category-escape.answer']}</p>}
      </figure>
    )
  }
  return (
    <div className="game-example">
      <ol>{steps.map((step) => <li key={step.label}>{'answer' in step ? format('example.step', { rule: step.label, answer: step.answer }) : step.label}</li>)}</ol>
      <p>{answer ? format('example.answer', { word: answer }) : en['welcome.category-escape.answer']}</p>
    </div>
  )
}
