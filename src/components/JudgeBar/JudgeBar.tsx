import './JudgeBar.css'

// A judge's marker, a dot for the cloud judge and a ring for the local one, and a bar
// from zero to a value ending in it. Decorative: the value is always in the text too.
// SVG attributes carry the runtime lengths, which the CSP allows on prerendered pages.

export type Judge = 'cloud' | 'device'

export function JudgeMarker({ judge }: { judge: Judge }) {
  return (
    <svg className={`judge-marker judge-marker--${judge}`} viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="4" strokeWidth="1.5" />
    </svg>
  )
}

const percent = (value: number) => `${String(Math.round(Math.min(1, Math.max(0, value)) * 1000) / 10)}%`

// `both` (agreement between the judges) has no marker; `target` draws a dashed mark
// across the track at that fraction.
export function JudgeBar({ judge, value, target }: { judge: Judge | 'both'; value: number; target?: number }) {
  const x = percent(value)
  return (
    <svg className={`judge-bar judge-bar--${judge}`} aria-hidden="true">
      <line className="judge-bar__track" x1="0" x2="100%" y1="50%" y2="50%" strokeWidth="1" />
      <line className="judge-bar__value" x1="0" x2={x} y1="50%" y2="50%" strokeWidth="2" />
      {target !== undefined && (
        <line
          className="judge-bar__target"
          x1={percent(target)}
          x2={percent(target)}
          y1="0"
          y2="100%"
          strokeWidth="2"
        />
      )}
      {judge !== 'both' && <circle className="judge-bar__marker" cx={x} cy="50%" r="4" strokeWidth="1.5" />}
    </svg>
  )
}
