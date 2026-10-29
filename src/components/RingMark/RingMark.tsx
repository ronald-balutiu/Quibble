import { en } from '@/copy/en'
import './RingMark.css'

// The mark (D-17, 5.3): three intersecting rings, one per game, with a point
// where they all overlap. Stroke widths are in viewBox units, so they live here.
export function RingMark() {
  return (
    <svg className="ring-mark" viewBox="-200 -190 400 380" role="img" aria-label={en['mark.label']}>
      <line className="ring-mark__axis" x1="-195" y1="11" x2="195" y2="11" />
      <line className="ring-mark__axis" x1="0" y1="-185" x2="0" y2="185" />
      <circle className="ring-mark__ring ring-mark__ring--oddly" cx="0" cy="-52" r="110" strokeWidth="1.5" />
      <circle className="ring-mark__ring ring-mark__ring--escape" cx="-64" cy="44" r="110" strokeWidth="1.5" />
      <circle className="ring-mark__ring ring-mark__ring--agent" cx="64" cy="44" r="110" strokeWidth="1.5" />
      <circle className="ring-mark__orbit" cx="0" cy="-52" r="114" strokeWidth="2" />
      <circle className="ring-mark__orbit ring-mark__orbit--slow" cx="-64" cy="44" r="114" strokeWidth="2" />
      <circle className="ring-mark__point" cx="0" cy="11" r="5" />
      <circle className="ring-mark__pulse" cx="0" cy="11" r="14" strokeWidth="0.8" />
    </svg>
  )
}
