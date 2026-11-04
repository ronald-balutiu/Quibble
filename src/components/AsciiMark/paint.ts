import { COLS, ROWS } from './frame'

// Draws one frame from `asciiMarkFrame` onto a canvas: each character centred in its
// cell, a layer at a time in that layer's colour. Cells fill the canvas, and a
// character is as tall as its row, so the drawing keeps its shape at any size.

export type PaintContext = Pick<
  CanvasRenderingContext2D,
  'canvas' | 'clearRect' | 'fillText' | 'font' | 'fillStyle' | 'textAlign' | 'textBaseline'
>

export function paintFrame(context: PaintContext, frame: string[], colors: string[], fontFamily: string) {
  const { width, height } = context.canvas
  const cell = { width: width / COLS, height: height / ROWS }
  context.clearRect(0, 0, width, height)
  context.font = `${String(cell.height)}px ${fontFamily}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  frame.forEach((layer, i) => {
    context.fillStyle = colors[i] ?? ''
    layer.split('\n').forEach((line, row) => {
      // The frame is ASCII, so each UTF-16 unit is one cell.
      for (let col = 0; col < line.length; col++) {
        const char = line.charAt(col)
        if (char !== ' ') context.fillText(char, (col + 0.5) * cell.width, (row + 0.5) * cell.height)
      }
    })
  })
}
