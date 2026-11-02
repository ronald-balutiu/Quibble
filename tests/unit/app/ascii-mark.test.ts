import { describe, expect, test } from 'vitest'
import { asciiMarkFrame, COLS, LAYERS, ROWS } from '@/components/AsciiMark/frame'

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

  test('the still frame is the mark: three facing rings around the centre point', () => {
    const still = asciiMarkFrame(0)
    expect(still).toEqual(asciiMarkFrame(0))
    expect(still.slice(0, 3).every((ring) => ring.trim().length > 0)).toBe(true)
    // The point sits where the rings meet, at the mark's centre (0, 11 in the SVG's viewBox).
    expect(still[3]?.replaceAll(/\s/gu, '')).toBe('@')
    expect(at(still, 3, Math.floor((201 / 380) * ROWS), COLS / 2)).toBe('@')
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
})
