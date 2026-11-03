// The ring mark (D-17, 5.3) drawn in characters: three rings, one per game, each a
// torus turning about the line from the mark's centre point through its own centre.
// At time 0 every ring faces the viewer, so the still frame is the mark itself.
// Pure, so the same frame renders on the server, in the browser and in tests.

export const COLS = 48
export const ROWS = 28

// The SVG mark's geometry (viewBox -200 -190 400 380, rings of radius 110).
const VIEW = { x: -200, y: -190, width: 400, height: 380 }
const POINT = { x: 0, y: 11 }
const RADIUS = 110
const TUBE = 16
// One full turn every `period` seconds; the escape ring turns the other way, as its orbit does.
const RINGS = [
  { cx: 0, cy: -52, period: 26, direction: 1 },
  { cx: -64, cy: 44, period: 34, direction: -1 },
  { cx: 64, cy: 44, period: 42, direction: 1 },
] as const
// The layers, back to front in the stack: one per ring. The centre, where they meet,
// is left clear.
export const LAYERS = ['oddly', 'escape', 'agent'] as const

// Darkest to brightest by ink. Mostly letters, since it's a word game.
const RAMP = '.:icoaxsezgdbqpkhmwMW'
// Weak perspective: the camera sits this far in front of the mark.
const CAMERA = 900
// Towards the viewer, from the upper left.
const LIGHT = normalize([-0.45, -0.55, -0.7])
const STEPS = { around: 220, tube: 20 }

type Vec = readonly [number, number, number]

function normalize([x, y, z]: Vec): Vec {
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
}

// Rodrigues' rotation of v by `angle` about the unit axis (ux, uy, 0).
function rotate([x, y, z]: Vec, ux: number, uy: number, cos: number, sin: number): Vec {
  const dot = ux * x + uy * y
  const cross: Vec = [uy * z, -ux * z, ux * y - uy * x]
  return [
    x * cos + cross[0] * sin + ux * dot * (1 - cos),
    y * cos + cross[1] * sin + uy * dot * (1 - cos),
    z * cos + cross[2] * sin,
  ]
}

// One string per layer, ROWS lines of COLS characters, blank where another ring is
// nearer or nothing is drawn. Stacked, they make the whole frame in the game colours.
export function asciiMarkFrame(seconds: number): string[] {
  const cells = COLS * ROWS
  const depth = new Float64Array(cells).fill(Infinity)
  const owner = new Int8Array(cells).fill(-1)
  const shade = new Uint8Array(cells)

  RINGS.forEach(({ cx, cy, period, direction }, ring) => {
    const length = Math.hypot(cx - POINT.x, cy - POINT.y)
    const ux = (cx - POINT.x) / length
    const uy = (cy - POINT.y) / length
    const angle = (direction * 2 * Math.PI * seconds) / period
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (let i = 0; i < STEPS.around; i++) {
      const phi = (2 * Math.PI * i) / STEPS.around
      for (let j = 0; j < STEPS.tube; j++) {
        const theta = (2 * Math.PI * j) / STEPS.tube
        const normal = rotate(
          [Math.cos(theta) * Math.cos(phi), Math.cos(theta) * Math.sin(phi), Math.sin(theta)],
          ux,
          uy,
          cos,
          sin,
        )
        const local = rotate([RADIUS * Math.cos(phi), RADIUS * Math.sin(phi), 0], ux, uy, cos, sin)
        const z = local[2] + TUBE * normal[2]
        const scale = CAMERA / (CAMERA + z)
        const x = (cx + local[0] + TUBE * normal[0] - POINT.x) * scale + POINT.x
        const y = (cy + local[1] + TUBE * normal[1] - POINT.y) * scale + POINT.y
        const col = Math.floor(((x - VIEW.x) / VIEW.width) * COLS)
        const row = Math.floor(((y - VIEW.y) / VIEW.height) * ROWS)
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue
        const cell = row * COLS + col
        if (z >= (depth[cell] ?? Infinity)) continue
        const light = normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]
        depth[cell] = z
        owner[cell] = ring
        shade[cell] = Math.round(Math.max(0, light) * (RAMP.length - 1))
      }
    }
  })

  return LAYERS.map((_, layer) => {
    let text = ''
    for (let row = 0; row < ROWS; row++) {
      if (row > 0) text += '\n'
      for (let col = 0; col < COLS; col++) {
        const cell = row * COLS + col
        text += owner[cell] === layer ? (RAMP[shade[cell] ?? 0] ?? ' ') : ' '
      }
    }
    return text
  })
}
