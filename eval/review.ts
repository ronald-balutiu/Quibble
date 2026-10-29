// Local keyboard view for confirming answer-key labels (plan 3.10).
// Usage: npm run ts -- eval/review.ts   then open http://127.0.0.1:5174
import { createServer } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { answerKeySchema } from '@shared/schemas/answer-key'

const port = 5174
const splits = { dev: 'eval/dev.json', test: 'eval/test.json' } as const
type Split = keyof typeof splits

const conditions = JSON.parse(readFileSync('factory/conditions.json', 'utf8')) as Record<string, { label: string, question: string }>
const load = (split: Split) => answerKeySchema.parse(JSON.parse(readFileSync(splits[split], 'utf8')))

const page = String.raw`<!doctype html><meta charset="utf-8"><title>Answer-key review</title>
<style>
body{font:15px/1.5 system-ui;margin:2rem auto;max-width:760px;background:#0c0b0a;color:#f3eee6}
.meta{color:#9c958c}.answer{font-size:2rem;margin:.5rem 0 1rem}
.c{border:1px solid #3d3833;padding:.6rem .8rem;margin:.4rem 0;display:flex;gap:1rem;align-items:center}
.c.on{border-color:#f4c677}.c b{width:5.5rem;text-align:center;padding:.2rem;border-radius:4px}
.yes{background:#1f3a24}.no{background:#45201b}.unsure{background:#3a3520}
.done{color:#8cd4ff}kbd{border:1px solid #625c55;border-radius:3px;padding:0 .3rem}
</style>
<div class="meta" id="progress"></div><div class="meta" id="where"></div>
<div class="answer" id="answer"></div><div id="conds"></div>
<p class="meta"><kbd>Y</kbd> yes · <kbd>N</kbd> no · <kbd>U</kbd> unsure · <kbd>↑↓</kbd> condition ·
<kbd>Enter</kbd> confirm case and go to the next unreviewed · <kbd>←→</kbd> previous / next case</p>
<p class="meta" id="status"></p>
<script>
let data, i = 0, focus = 0
const $ = (id) => document.getElementById(id)
const all = () => [...data.dev.map((c) => ['dev', c]), ...data.test.map((c) => ['test', c])]
function render() {
  const list = all(), [split, c] = list[i], reviewed = list.filter(([, x]) => x.reviewed).length
  $('progress').textContent = reviewed + ' / ' + list.length + ' reviewed'
  $('where').innerHTML = split + ' · ' + c.id + ' · ' + c.game + (c.level ? ' level ' + c.level : '') + ' · ' + c.kind + (c.reviewed ? ' · <span class="done">confirmed</span>' : '')
  $('answer').textContent = '"' + c.answer + '"'
  $('conds').replaceChildren(...c.conditions.map((k, j) => {
    const row = document.createElement('div'), tag = document.createElement('b'), text = document.createElement('span')
    row.className = 'c' + (j === focus ? ' on' : ''); tag.className = k.expected; tag.textContent = k.expected
    text.textContent = k.clue ? 'Can the word mean: ' + k.clue + '?' : data.conditions[k.id].question
    row.append(tag, text); return row
  }))
}
async function save(split) {
  const res = await fetch('/cases/' + split, { method: 'POST', body: JSON.stringify(data[split]) })
  $('status').textContent = res.ok ? 'Saved ' + split + '.json' : 'Save failed: ' + await res.text()
}
addEventListener('keydown', async (e) => {
  const list = all(), [split, c] = list[i], label = { y: 'yes', n: 'no', u: 'unsure' }[e.key.toLowerCase()]
  if (label) { c.conditions[focus].expected = label; focus = Math.min(focus + 1, c.conditions.length - 1); c.reviewed = false; await save(split) }
  else if (e.key === 'ArrowDown') focus = Math.min(focus + 1, c.conditions.length - 1)
  else if (e.key === 'ArrowUp') focus = Math.max(focus - 1, 0)
  else if (e.key === 'ArrowRight') { i = Math.min(i + 1, list.length - 1); focus = 0 }
  else if (e.key === 'ArrowLeft') { i = Math.max(i - 1, 0); focus = 0 }
  else if (e.key === 'Enter') {
    c.reviewed = true; await save(split)
    const next = list.findIndex(([, x], j) => j > i && !x.reviewed); if (next >= 0) i = next; focus = 0
  } else return
  e.preventDefault(); render()
})
fetch('/cases').then((r) => r.json()).then((d) => { data = d; i = Math.max(0, all().findIndex(([, c]) => !c.reviewed)); render() })
</script>`

createServer((req, res): void => {
  const send = (status: number, body: string, type = 'text/plain'): void => { res.writeHead(status, { 'Content-Type': type }).end(body) }
  if (req.method === 'GET' && req.url === '/') return send(200, page, 'text/html')
  if (req.method === 'GET' && req.url === '/cases') {
    return send(200, JSON.stringify({ dev: load('dev'), test: load('test'), conditions }), 'application/json')
  }
  const split = /^\/cases\/(dev|test)$/u.exec(req.url ?? '')?.[1] as Split | undefined
  if (req.method !== 'POST' || !split) return send(404, 'Not found')
  let body = ''
  req.on('data', (chunk: Buffer) => { body += chunk.toString() })
  req.on('end', (): void => {
    const parsed = answerKeySchema.safeParse(JSON.parse(body))
    if (!parsed.success) return send(400, parsed.error.message)
    writeFileSync(splits[split], `${JSON.stringify(parsed.data, null, 2)}\n`)
    return send(204, '')
  })
}).listen(port, '127.0.0.1', () => { console.log(`Review answer-key labels at http://127.0.0.1:${String(port)}`) })
