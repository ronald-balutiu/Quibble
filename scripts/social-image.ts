// Renders the share image (public/og.png, 1200 × 630) and the favicon
// (public/favicon.svg) from the ring mark (5.1, 5.3: one mark everywhere). The share
// image shows the mark as Home does, in characters at its still frame, beside Home's
// headline; the favicon keeps the drawn rings, which read at 16px.
// Usage: npm run ts -- scripts/social-image.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { asciiMarkFrame, LAYERS } from '../src/components/AsciiMark/frame.ts'
import { en } from '../src/copy/en.ts'

const font = (path: string) =>
  `data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/${path}`).toString('base64')}`
const colors = {
  ground: '#0C0B0A',
  text: '#F3EEE6',
  muted: '#9C958C',
  line: '#22201D',
  oddly: '#F4C677',
  escape: '#8CD4FF',
  agent: '#F7B1DF',
}

// The hero mark's geometry (src/components/RingMark/RingMark.tsx), drawn statically.
const rings = (width: number) => `
  <circle cx="0" cy="-52" r="110" fill="none" stroke="${colors.oddly}" stroke-width="${String(width)}"/>
  <circle cx="-64" cy="44" r="110" fill="none" stroke="${colors.escape}" stroke-width="${String(width)}"/>
  <circle cx="64" cy="44" r="110" fill="none" stroke="${colors.agent}" stroke-width="${String(width)}"/>`
// The still frame, one stacked <pre> per ring in its game's colour.
const ink: Record<(typeof LAYERS)[number], string> = { oddly: colors.oddly, escape: colors.escape, agent: colors.agent }
const mark = `<div class="mark">${asciiMarkFrame(0)
  .map((layer, i) => `<pre style="color: ${ink[LAYERS[i] ?? 'oddly']}">${layer}</pre>`)
  .join('')}</div>`

writeFileSync(
  'public/favicon.svg',
  `<svg viewBox="-190 -180 380 360" xmlns="http://www.w3.org/2000/svg"><rect x="-190" y="-180" width="380" height="360" rx="40" fill="${colors.ground}"/>${rings(22)}<circle cx="0" cy="11" r="26" fill="${colors.text}"/></svg>\n`,
)

const html = `<!doctype html><html><head><style>
  @font-face { font-family: Geist; font-weight: 300; src: url(${font('geist/files/geist-latin-300-normal.woff2')}) }
  @font-face { font-family: 'Geist Mono'; src: url(${font('geist-mono/files/geist-mono-latin-400-normal.woff2')}) }
  body { margin: 0; width: 1200px; height: 630px; background: ${colors.ground}; color: ${colors.text}; font-family: Geist; display: flex; align-items: center; }
  .text { flex: 1; padding-left: 80px; }
  .eyebrow { font-family: 'Geist Mono'; font-size: 20px; letter-spacing: 0.12em; text-transform: uppercase; color: ${colors.muted}; }
  h1 { margin: 24px 0; font-size: 112px; font-weight: 300; line-height: 0.92; letter-spacing: -0.05em; }
  p { margin: 0; font-size: 28px; color: ${colors.muted}; max-width: 560px; line-height: 1.35; text-wrap: balance; }
  .mark { display: grid; margin-right: 72px; font-family: 'Geist Mono'; font-size: 17px; line-height: 1; }
  .mark pre { grid-area: 1 / 1; margin: 0; font: inherit; white-space: pre; }
</style></head><body><div class="text"><div class="eyebrow">${en['app.name']} · three word games</div><h1>${en['home.title']}</h1><p>${en['about.lede']}</p></div>${mark}</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.evaluate('document.fonts.ready')
await page.screenshot({ path: 'public/og.png' })
await browser.close()
console.log('Wrote public/og.png and public/favicon.svg.')
