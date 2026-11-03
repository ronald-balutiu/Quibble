import { useEffect, useRef } from 'react'
import { asciiMarkFrame, COLS, LAYERS, ROWS } from './frame'
import { paintFrame } from './paint'
import './AsciiMark.css'

// The ring mark in turning characters, for Home and the 404 page. It's drawn on a
// canvas rather than set as text: thousands of characters a few pixels tall would be
// most of the page's text, and fail Lighthouse's legible-font audit. With a label
// it's an image; without one it's decorative, as on the 404, whose own text says what
// happened. The first frame is the still mark, which is all that shows under reduced
// motion; otherwise the canvas is redrawn a few times a second, without React
// rendering again.

const FRAME_MS = 1000 / 15
// A hidden tab stops animation frames; resume where the rings were, not with a jump.
const MAX_STEP_MS = 100
// The canvas's size before it's measured, in Geist Mono's 3:5 cells, so its box has
// the mark's shape from the first layout. CSS sets the width.
const CELL = { width: 6, height: 10 }
const INKS: Record<(typeof LAYERS)[number], string> = {
  oddly: '--game-oddly',
  escape: '--game-escape',
  agent: '--game-agent',
  point: '--text',
}

export function AsciiMark({ label }: { label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const style = getComputedStyle(canvas)
    const colors = LAYERS.map((layer) => style.getPropertyValue(INKS[layer]).trim())
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = asciiMarkFrame(0)
    let request = 0
    const draw = () => {
      paintFrame(context, frame, colors, style.fontFamily)
    }
    // Match the canvas's pixels to its size on screen, so the characters stay sharp.
    const resize = () => {
      const width = Math.round(canvas.getBoundingClientRect().width * window.devicePixelRatio)
      if (width === 0 || width === canvas.width) return
      canvas.width = width
      canvas.height = Math.round((width * ROWS * CELL.height) / (COLS * CELL.width))
      draw()
    }
    const stop = () => {
      cancelAnimationFrame(request)
      frame = asciiMarkFrame(0)
      draw()
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
          frame = asciiMarkFrame(elapsed / 1000)
          draw()
        }
        request = requestAnimationFrame(tick)
      }
      request = requestAnimationFrame(tick)
    }
    const update = () => {
      if (reduced.matches) stop()
      else start()
    }
    const change = () => {
      cancelAnimationFrame(request)
      update()
    }
    resize()
    update()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    reduced.addEventListener('change', change)
    // Until Geist Mono loads, the first frames use the fallback font.
    let live = true
    void document.fonts.load(`${String(CELL.height)}px ${style.fontFamily}`).then(() => {
      if (live) draw()
    })
    return () => {
      live = false
      observer.disconnect()
      reduced.removeEventListener('change', change)
      cancelAnimationFrame(request)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      className="ascii-mark"
      width={COLS * CELL.width}
      height={ROWS * CELL.height}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  )
}
