import { ESLint } from 'eslint'
import { expect, test } from 'vitest'

const eslint = new ESLint()

test.each([
  ['raw visible copy', 'export function Example() { return <p>Hard coded</p> }', 'react/jsx-no-literals'],
  ['string expressions', "export function Example() { return <p>{'Hard coded'}</p> }", 'react/jsx-no-literals'],
  ['accessible copy', 'export function Example() { return <input aria-label="Hard coded" /> }', 'no-restricted-syntax'],
  ['missing alt text', 'export function Example() { return <img src="/example.png" /> }', 'jsx-a11y-x/alt-text'],
  ['direct storage', 'export const store = localStorage', 'no-restricted-globals'],
  ['window storage', 'export const store = window.localStorage', 'no-restricted-globals'],
  ['global storage', "export const store = globalThis['localStorage']", 'no-restricted-globals'],
  ['inline styles', "export function Example() { return <div style={{ color: '#fff', padding: 12 }} /> }", 'react/forbid-dom-props'],
  ['style variables', 'export function Example({ styles }: { styles: import("react").CSSProperties }) { return <div style={styles} /> }', 'react/forbid-dom-props'],
  ['unapproved custom-property inline styles', 'export function Example({ progress }: { progress: number }) { return <div style={{ "--download-progress": progress } as import("react").CSSProperties} /> }', 'react/forbid-dom-props'],
  ['component inline styles', 'import { Link } from "react-router"; export function Example() { return <Link to="/" style={{ color: "#fff" }} /> }', 'react/forbid-component-props'],
])('lint rejects %s', async (_name, source, ruleId) => {
  const [result] = await eslint.lintText(source, { filePath: 'src/app/App.tsx' })

  expect(result?.messages.some((message) => message.ruleId === ruleId)).toBe(true)
})

test.each(['factory', 'eval'])('the Worker cannot import %s scripts', async (folder) => {
  const [result] = await eslint.lintText(`import '../${folder}/example'`, { filePath: 'worker/index.ts' })

  expect(result?.messages.some((message) => message.ruleId === 'no-restricted-imports')).toBe(true)
})

test('copy references and structural JSX props are allowed', async () => {
  const [result] = await eslint.lintText(
    "import { en } from '@/copy/en'; export function Example() { return <p className=\"label\" title={en['home.title']}>{en['home.title']}</p> }",
    { filePath: 'src/app/App.tsx' },
  )

  expect(result?.messages).toEqual([])
})

test('the guarded storage directory is exempt from the raw storage restriction', async () => {
  const config: unknown = await eslint.calculateConfigForFile('src/lib/storage/index.ts')

  expect(config).not.toHaveProperty('rules.no-restricted-globals')
})

test.each([
  '{ color: "#fff" }',
  '{ padding: 12 }',
  '{ "--download-progress": 0.5 }',
  '{ "--download-progress": `50%` }',
  '{ "--download-progress": -1 }',
  '{ ...props.styles }',
  'props.styles',
  'props.styles as CSSProperties',
  '{ [props.variable]: props.progress }',
])('a local style exception still rejects %s', async (style) => {
  const [result] = await eslint.lintText(
    `import type { CSSProperties } from 'react'
     export function Example(props: { styles: CSSProperties; progress: number; variable: string }) {
       // eslint-disable-next-line react/forbid-dom-props -- Regression probe for a narrowly scoped dynamic exception.
       return <div style={${style}} />
     }`,
    { filePath: 'src/app/App.tsx' },
  )

  expect(result?.messages.some((message) => message.ruleId === 'no-restricted-syntax')).toBe(true)
})

test('a documented dynamic custom-property exception is allowed', async () => {
  const [result] = await eslint.lintText(
    `import type { CSSProperties } from 'react'
     export function Example({ progress }: { progress: number }) {
       // eslint-disable-next-line react/forbid-dom-props -- S4 progress is measured at runtime; CSS owns its visual treatment.
       return <div style={{ '--download-progress': progress } as CSSProperties} />
     }`,
    { filePath: 'src/app/App.tsx' },
  )

  expect(result?.messages).toEqual([])
})
