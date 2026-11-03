import { useEffect, useRef } from 'react'
import { asciiMarkFrame, LAYERS } from './frame'
import './AsciiMark.css'

// The ring mark in turning characters, for Home and the 404 page. With a label it's
// an image; without one it's decorative, as on the 404, whose own text says what
// happened. The first frame is the still mark, which is all that shows under reduced
// motion; otherwise each layer's text is rewritten in place, a few times a second,
// without React rendering again.

const STILL = asciiMarkFrame(0)
const FRAME_MS = 1000 / 15
// A hidden tab stops animation frames; resume where the rings were, not with a jump.
const MAX_STEP_MS = 100

export function AsciiMark({ label }: { label?: string }) {
  const layers = useRef<(HTMLPreElement | null)[]>([])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let request = 0
    const draw = (seconds: number) => {
      asciiMarkFrame(seconds).forEach((text, i) => {
        const layer = layers.current[i]
        if (layer) layer.textContent = text
      })
    }
    const stop = () => {
      cancelAnimationFrame(request)
      draw(0)
    }
    const start = () => {
      let elapsed = 0
      let last: number | undefined
      let drawn = 0
      const tick = (now: number) => {
        elapsed += Math.min(MAX_STEP_MS, now - (last ?? now))
        last = now
        if (elapsed - drawn >= FRAME_MS) {
          drawn = elapsed
          draw(elapsed / 1000)
        }
        request = requestAnimationFrame(tick)
      }
      request = requestAnimationFrame(tick)
    }
    const update = () => {
      if (reduced.matches) stop()
      else start()
    }
    update()
    const change = () => {
      cancelAnimationFrame(request)
      update()
    }
    reduced.addEventListener('change', change)
    return () => {
      reduced.removeEventListener('change', change)
      cancelAnimationFrame(request)
    }
  }, [])

  return (
    <div className="ascii-mark" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      {LAYERS.map((name, i) => (
        <pre
          key={name}
          className={`ascii-mark__layer ascii-mark__layer--${name}`}
          ref={(node) => {
            layers.current[i] = node
          }}
        >
          {STILL[i]}
        </pre>
      ))}
    </div>
  )
}
