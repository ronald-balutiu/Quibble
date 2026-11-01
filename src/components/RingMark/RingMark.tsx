import { useState, type CSSProperties } from 'react'
import { en } from '@/copy/en'
import './RingMark.css'

// The mark (D-17, 5.3): three intersecting rings, one per game, with a point
// where they all overlap. Stroke widths are in viewBox units, so they live here.

const RINGS = [
  { cx: 0, cy: -52, reverse: false },
  { cx: -64, cy: 44, reverse: true },
  { cx: 64, cy: 44, reverse: false },
] as const
const SPEEDS = ['--t-orbit-a', '--t-orbit-b', '--t-orbit-c'] as const

// Each time the mark appears, every arc starts at a random point and takes one of
// the three preset speeds, shuffled.
function randomOrbits() {
  const speeds = [...SPEEDS]
  for (let i = speeds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[speeds[i], speeds[j]] = [speeds[j] ?? SPEEDS[0], speeds[i] ?? SPEEDS[0]]
  }
  return RINGS.map((ring, i) => ({ ...ring, speed: speeds[i] ?? SPEEDS[0], start: Math.random() }))
}

// The progress variant (S4) draws each ring over a third of the download, from
// `progress` (0–1), over dotted outlines. The centre point lights up at 100%.
export function RingMark({ progress, label = en['mark.label'] }: { progress?: number, label?: string }) {
  const [orbits] = useState(randomOrbits)
  const drawing = progress !== undefined
  const complete = !drawing || progress >= 1
  return (
    <svg
      className={drawing ? 'ring-mark ring-mark--progress' : 'ring-mark'} viewBox="-200 -190 400 380" role="img" aria-label={label}
      // eslint-disable-next-line react/forbid-dom-props -- S4's ring drawing follows the real byte count (D-25, D-50).
      style={{ '--progress': progress ?? 1 } as CSSProperties}
    >
      <line className="ring-mark__axis" x1="-195" y1="11" x2="195" y2="11" />
      <line className="ring-mark__axis" x1="0" y1="-185" x2="0" y2="185" />
      {drawing && RINGS.map(({ cx, cy }) => <circle key={`${String(cx)},${String(cy)}`} className="ring-mark__outline" cx={cx} cy={cy} r="110" />)}
      {/* Each ring starts drawing where the mock's does: the top, lower left and lower right. */}
      <circle className="ring-mark__ring ring-mark__ring--oddly" cx="0" cy="-52" r="110" strokeWidth="1.5" pathLength={1} transform="rotate(-90 0 -52)" />
      <circle className="ring-mark__ring ring-mark__ring--escape" cx="-64" cy="44" r="110" strokeWidth="1.5" pathLength={1} transform="rotate(150 -64 44)" />
      <circle className="ring-mark__ring ring-mark__ring--agent" cx="64" cy="44" r="110" strokeWidth="1.5" pathLength={1} transform="rotate(30 64 44)" />
      {orbits.map(({ cx, cy, reverse, speed, start }) => (
        <circle
          key={`${String(cx)},${String(cy)}`} className={reverse ? 'ring-mark__orbit ring-mark__orbit--reverse' : 'ring-mark__orbit'}
          cx={cx} cy={cy} r="114" strokeWidth="2"
          // eslint-disable-next-line react/forbid-dom-props -- the start angle and speed are picked at runtime; CSS owns the styling.
          style={{ '--orbit-start': start, '--orbit-duration': `var(${speed})` } as CSSProperties}
        />
      ))}
      <circle className={complete ? 'ring-mark__point' : 'ring-mark__point ring-mark__point--waiting'} cx="0" cy="11" r={complete ? 5 : 3} />
      {complete && <circle className="ring-mark__pulse" cx="0" cy="11" r="14" strokeWidth="0.8" />}
    </svg>
  )
}
