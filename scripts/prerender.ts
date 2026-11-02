// Fills each route page in dist/client with its first screen (npm run build runs it
// after vite build), so the header, page text and layout paint before any script
// runs. src/prerender.tsx renders through Vite's SSR loader, which resolves the app's
// aliases and skips its CSS. 404.html stays empty: unknown paths render on the client.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'

const ROOT = 'dist/client'
const MOUNT = '<div id="root"></div>'

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'assets' ? [] : pages(path)
    return entry.name.endsWith('.html') && entry.name !== '404.html' ? [path] : []
  })
}

// index.html is "/", play.html is "/play", play/oddly-specific/1.html is that puzzle.
const routeOf = (file: string) => `/${relative(ROOT, file).replace(/\.html$/u, '').replace(/^index$/u, '')}`

const vite = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
  plugins: [react()],
  resolve: { alias: { '@': join(process.cwd(), 'src'), '@shared': join(process.cwd(), 'shared') } },
})
try {
  const { render } = await vite.ssrLoadModule('/src/prerender.tsx') as { render: (path: string) => Promise<string> }
  const files = pages(ROOT)
  for (const file of files) {
    const html = readFileSync(file, 'utf8')
    if (!html.includes(MOUNT)) throw new Error(`${file} has no empty ${MOUNT} to fill.`)
    // The content security policy (style-src 'self') blocks style attributes in
    // HTML, so they're dropped here; React sets those custom properties once live.
    const app = (await render(routeOf(file))).replace(/ style="[^"]*"/gu, '')
    writeFileSync(file, html.replace(MOUNT, `<div id="root">${app}</div>`))
  }
  console.log(`Prerendered ${String(files.length)} pages.`)
} finally {
  await vite.close()
}
