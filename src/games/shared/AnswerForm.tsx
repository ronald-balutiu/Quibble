import type { RefObject } from 'react'
import { en } from '@/copy/en'

// The answer field and its Judge button (G1–G3).
// `judging` locks and greys the field until both judges are back (3.7). `locked`
// does the same without the JUDGING label, after the last allowed miss.
export function AnswerForm({
  label,
  placeholder,
  answer,
  maxLength,
  judging,
  locked = false,
  input,
  onType,
  onSubmit,
  invalid,
}: {
  label: string
  placeholder: string
  answer: string
  maxLength: number
  judging: boolean
  locked?: boolean
  input: RefObject<HTMLInputElement | null>
  onType: (value: string) => void
  onSubmit: () => void
  invalid?: boolean
}) {
  const disabled = judging || locked
  return (
    <form
      className={invalid ? 'answer answer--invalid' : 'answer'}
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled) onSubmit()
      }}
    >
      <label htmlFor="answer" className="telemetry">
        {label}
      </label>
      <input
        ref={input}
        id="answer"
        value={answer}
        autoComplete="off"
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby="answer-note"
        aria-invalid={invalid}
        onChange={(event) => {
          onType(event.target.value)
        }}
      />
      <button type="submit" className="answer__judge" disabled={!answer.trim() || disabled}>
        {judging ? en['game.judging'] : en['game.judge']}
      </button>
    </form>
  )
}
