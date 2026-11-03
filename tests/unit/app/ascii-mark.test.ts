import { describe, expect, test } from 'vitest'
import { asciiMarkFrame, COLS, LAYERS, ROWS } from '@/components/AsciiMark/frame'
import { paintFrame, type PaintContext } from '@/components/AsciiMark/paint'

// Each layer's character at a cell, or undefined where it's blank.
const at = (frame: string[], layer: number, row: number, col: number) => {
  const char = frame[layer]?.split('\n')[row]?.[col]
  return char === ' ' ? undefined : char
}

describe('the ASCII ring mark', () => {
  test('every layer is a full grid, and no two layers draw the same cell', () => {
    const frame = asciiMarkFrame(7.3)
    expect(frame).toHaveLength(LAYERS.length)
    for (const layer of frame) {
      const lines = layer.split('\n')
      expect(lines).toHaveLength(ROWS)
      expect(lines.every((line) => line.length === COLS)).toBe(true)
    }
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        expect(LAYERS.filter((_, layer) => at(frame, layer, row, col) !== undefined).length).toBeLessThanOrEqual(1)
      }
    }
  })

  test('the still frame is the mark: three facing rings around a clear centre', () => {
    const still = asciiMarkFrame(0)
    expect(still).toEqual(asciiMarkFrame(0))
    expect(still.every((ring) => ring.trim().length > 0)).toBe(true)
    // Where the rings meet, at the mark's centre (0, 11 in the SVG's viewBox), nothing is drawn.
    const centre = Math.floor((201 / 380) * ROWS)
    expect(LAYERS.every((_, layer) => at(still, layer, centre, COLS / 2) === undefined)).toBe(true)
    // Facing the viewer, the top ring's hole is clear and its edge drawn.
    expect(at(still, 0, Math.floor((138 / 380) * ROWS), COLS / 2)).toBeUndefined()
    expect(at(still, 0, 1, COLS / 2)).toBeDefined()
  })

  test('the rings turn slowly: one frame to the next changes only a few cells', () => {
    const cells = (frame: string[]) => frame.map((layer) => layer.replaceAll('\n', '')).join('')
    const changed = (a: string[], b: string[]) => [...cells(a)].filter((char, i) => char !== cells(b)[i]).length
    expect(asciiMarkFrame(5)).not.toEqual(asciiMarkFrame(0))
    expect(changed(asciiMarkFrame(5), asciiMarkFrame(5 + 1 / 15))).toBeLessThan(LAYERS.length * COLS * ROWS * 0.05)
  })

  test('a frame paints each character centred in its cell, in its layer’s colour', () => {
    const calls: { char: string; x: number; y: number; color: string }[] = []
    const context: PaintContext = {
      canvas: { width: COLS * 6, height: ROWS * 10 } as HTMLCanvasElement,
      clearRect: () => undefined,
      fillText(char: string, x: number, y: number) {
        calls.push({ char, x, y, color: typeof this.fillStyle === 'string' ? this.fillStyle : '' })
      },
      font: '',
      fillStyle: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
    }
    const frame = asciiMarkFrame(0)
    paintFrame(context, frame, ['honey', 'sky', 'orchid'], 'Geist Mono')
    expect(context.font).toBe('10px Geist Mono')
    expect(calls).toHaveLength(frame.join('').replaceAll(/\s/gu, '').length)
    // The last ring's first character, in that layer's colour, sits in its cell's centre.
    const lines = frame[2]?.split('\n') ?? []
    const row = lines.findIndex((line) => line.trim().length > 0)
    const col = lines[row]?.search(/\S/u) ?? -1
    const char = lines[row]?.[col]
    expect(calls.find((call) => call.color === 'orchid')).toEqual({
      char,
      x: col * 6 + 3,
      y: row * 10 + 5,
      color: 'orchid',
    })
    expect(new Set(calls.map(({ color }) => color))).toEqual(new Set(['honey', 'sky', 'orchid']))
  })
})
