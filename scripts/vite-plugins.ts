import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { gzipSync } from 'node:zlib'
import type { OutputAsset, OutputChunk } from 'rolldown'
import type { Plugin } from 'vite'
import { gameIds } from '../shared/games/index.ts'
import { puzzleIndexSchema } from '../shared/schemas/puzzle.ts'
import { SITE_ORIGIN } from '../shared/site.ts'
import { libraryPath, puzzlePath } from '../src/lib/paths.ts'
import { en, format, puzzleNumber } from '../src/copy/en.ts'

// Build plugins for vite.config.ts: the on-device judge's runtime, the sitemap, and
// one HTML page per route. Each runs in the client build only unless noted.

const fromRoot = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url))

// Every puzzle in the built index, checked against its schema.
function puzzles() {
  const index = puzzleIndexSchema.parse(JSON.parse(readFileSync(fromRoot('public/puzzles/index.json'), 'utf8')))
  return gameIds.flatMap((game) => (index[game] ?? []).map(({ n }) => ({ game, n, path: puzzlePath(game, n) })))
}

// The on-device judge's WebGPU runtime (the asyncify build that onnxruntime-web/webgpu
// loads, 28.7 MB) is over the 25 MiB static asset limit, so it ships gzipped (7.1 MB)
// and src/judges/device/worker.ts unpacks it.
const ORT_RUNTIME = 'ort/runtime.wasm.gz'
export function ortRuntime(): Plugin {
  const packed = () =>
    gzipSync(readFileSync(fromRoot('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm')))
  return {
    name: 'quibble:ort-runtime',
    applyToEnvironment: (environment) => environment.name === 'client',
    configureServer(server) {
      server.middlewares.use(`/${ORT_RUNTIME}`, (_request, response) => {
        response.setHeader('Content-Type', 'application/gzip')
        response.end(packed())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: ORT_RUNTIME, source: packed() })
    },
  }
}

// onnxruntime-web's bundle also emits the raw runtime for its fallback path. The
// worker always passes the unpacked binary instead, so that copy is never fetched.
export function dropRawOrtRuntime(): Plugin {
  return {
    name: 'quibble:drop-raw-ort-runtime',
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle))
        if (/ort-wasm-simd-threaded\.[\w.-]*\.wasm$/u.test(name)) Reflect.deleteProperty(bundle, name)
    },
  }
}

// For search engines (robots.txt points here): Home, the Library and every puzzle,
// listed from the built puzzle index.
export function sitemap(): Plugin {
  return {
    name: 'quibble:sitemap',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle() {
      const paths = ['/', libraryPath(), '/about', ...puzzles().map(({ path }) => path)]
      const urls = paths.map((path) => `  <url><loc>${SITE_ORIGIN}${path}</loc></url>`).join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      })
    },
  }
}

// One HTML page per route, beside index.html, which Cloudflare serves for its path
// (/play from play.html). Each names its title, description and canonical URL for
// search engines, and asks for everything the route needs at once: its screen's
// chunks and stylesheet, its puzzle data, and the fonts above the fold. Without
// them the browser learns of each only after the app script has run. Unknown paths
// get 404.html (wrangler.jsonc), the same shell with nothing prerendered, so the app
// renders whatever the path is and search engines see a 404.
type Chunk = OutputChunk & { viteMetadata?: { importedCss: Set<string> } }
interface RoutePage {
  path: string
  scene?: string
  data?: string
  title: string
  description: string
}

const escapeHtml = (text: string) =>
  text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;')
const FONTS = [
  /^assets\/geist-latin-300-normal-[\w-]+\.woff2$/u,
  /^assets\/geist-latin-400-normal-[\w-]+\.woff2$/u,
  /^assets\/geist-mono-latin-400-normal-[\w-]+\.woff2$/u,
]

function routePageList(): RoutePage[] {
  return [
    {
      path: libraryPath(),
      scene: 'src/scenes/library/LibraryScene.tsx',
      data: '/puzzles/index.json',
      title: en['meta.title.library'],
      description: en['meta.description.library'],
    },
    {
      path: '/about',
      scene: 'src/scenes/about/AboutScene.tsx',
      title: en['meta.title.about'],
      description: en['meta.description.about'],
    },
    ...puzzles().map(({ game, n, path }) => {
      const values = { game: en[`game.name.${game}`], n: puzzleNumber(n), tagline: en[`game.tagline.${game}`] }
      return {
        path,
        scene: 'src/scenes/game/GameScene.tsx',
        data: `/puzzles/${game}/${String(n)}.json`,
        title: format('meta.title.game', values),
        description: format('meta.description.game', values),
      }
    }),
  ]
}

export function routePages(): Plugin {
  return {
    name: 'quibble:route-pages',
    enforce: 'post',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'] as OutputAsset | undefined
      if (!html) return
      const chunks = Object.values(bundle).filter((file): file is Chunk => file.type === 'chunk')
      const closure = (chunk: Chunk, seen = new Set<string>()): Set<string> => {
        if (seen.has(chunk.fileName)) return seen
        seen.add(chunk.fileName)
        for (const name of chunk.imports) {
          const next = bundle[name]
          if (next?.type === 'chunk') closure(next, seen)
        }
        return seen
      }
      const entry = chunks.find((chunk) => chunk.isEntry)
      if (!entry) return
      const loaded = closure(entry)
      const link = (attributes: string) => `    <link ${attributes} />\n`
      const fonts = Object.keys(bundle)
        .filter((name) => FONTS.some((pattern) => pattern.test(name)))
        .map((name) => link(`rel="preload" href="/${name}" as="font" type="font/woff2" crossorigin`))
        .join('')
      const base = String(html.source).replace(/ *<\/head>/u, `${fonts}  </head>`)
      html.source = base.replace(/ *<\/head>/u, `${link(`rel="canonical" href="${SITE_ORIGIN}/"`)}  </head>`)
      this.emitFile({ type: 'asset', fileName: '404.html', source: base })

      for (const page of routePageList()) {
        const scene = page.scene ? chunks.find((chunk) => chunk.facadeModuleId?.endsWith(page.scene ?? '')) : undefined
        if (page.scene && !scene) throw new Error(`No chunk for ${page.scene}`)
        const files = scene ? [...closure(scene)].filter((name) => !loaded.has(name)) : []
        const css = files.flatMap((name) => [...((bundle[name] as Chunk).viteMetadata?.importedCss ?? [])])
        const head = [
          link(`rel="canonical" href="${SITE_ORIGIN}${page.path}"`),
          ...css.map((name) => link(`rel="stylesheet" crossorigin href="/${name}"`)),
          ...files.map((name) => link(`rel="modulepreload" crossorigin href="/${name}"`)),
          page.data ? link(`rel="preload" href="${page.data}" as="fetch" crossorigin`) : '',
        ].join('')
        const source = base
          .replace(/<title>[^<]*<\/title>/u, `<title>${escapeHtml(page.title)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*/u, `$1${escapeHtml(page.description)}`)
          .replace(/(<meta property="og:title" content=")[^"]*/u, `$1${escapeHtml(page.title)}`)
          .replace(/(<meta property="og:description" content=")[^"]*/u, `$1${escapeHtml(page.description)}`)
          .replace(/(<meta property="og:url" content=")[^"]*/u, `$1${SITE_ORIGIN}${page.path}`)
          .replace(/ *<\/head>/u, `${head}  </head>`)
        this.emitFile({ type: 'asset', fileName: `${page.path.slice(1)}.html`, source })
      }
    },
  }
}
