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

export function RingMark() {
  const [orbits] = useState(randomOrbits)
  return (
    <svg className="ring-mark" viewBox="-200 -190 400 380" role="img" aria-label={en['mark.label']}>
      <line className="ring-mark__axis" x1="-195" y1="11" x2="195" y2="11" />
      <line className="ring-mark__axis" x1="0" y1="-185" x2="0" y2="185" />
      <circle className="ring-mark__ring ring-mark__ring--oddly" cx="0" cy="-52" r="110" strokeWidth="1.5" />
      <circle className="ring-mark__ring ring-mark__ring--escape" cx="-64" cy="44" r="110" strokeWidth="1.5" />
      <circle className="ring-mark__ring ring-mark__ring--agent" cx="64" cy="44" r="110" strokeWidth="1.5" />
      {orbits.map(({ cx, cy, reverse, speed, start }) => (
        <circle
          key={`${String(cx)},${String(cy)}`} className={reverse ? 'ring-mark__orbit ring-mark__orbit--reverse' : 'ring-mark__orbit'}
          cx={cx} cy={cy} r="114" strokeWidth="2"
          // eslint-disable-next-line react/forbid-dom-props -- the start angle and speed are picked at runtime; CSS owns the styling.
          style={{ '--orbit-start': start, '--orbit-duration': `var(${speed})` } as CSSProperties}
        />
      ))}
      <circle className="ring-mark__point" cx="0" cy="11" r="5" />
      <circle className="ring-mark__pulse" cx="0" cy="11" r="14" strokeWidth="0.8" />
    </svg>
  )
}
