import stylelint from 'stylelint'
import { expect, test } from 'vitest'

test.each([
  'color: #fff',
  'background: rgb(12 11 10)',
  'background-color: red',
  'font-family: Geist',
  'font-size: 20px',
  'font-weight: 700',
  'line-height: 1.5',
  'letter-spacing: -0.03em',
  'padding: 12px',
  'padding: var(--space-1) 12px',
  'margin-inline: 1rem',
  'gap: 8px',
  'padding: calc(var(--space-1) + 1px)',
  'color: var(--text, red)',
  'border: 1px solid var(--line)',
  'border: var(--border-width) solid red',
  'outline-offset: 2px',
  'width: 28px',
  '--sneaky-token: 12px',
])('CSS lint rejects raw declaration %s', async (declaration) => {
  const result = await stylelint.lint({
    code: `.example { ${declaration}; }`,
    codeFilename: 'src/styles/probe.css',
    configFile: 'stylelint.config.js',
  })

  expect(result.errored).toBe(true)
  expect(result.results[0]?.warnings.some((warning) => warning.rule === 'declaration-property-value-allowed-list')).toBe(true)
})

test('token references, structural resets and fluid sizing are allowed', async () => {
  const result = await stylelint.lint({
    code: `.example {
      color: var(--text);
      background: var(--ground);
      font: inherit;
      font-size: var(--type-body);
      padding: var(--space-1) var(--space-2);
      margin: 0 auto;
      border: var(--border-width) solid var(--line);
      min-width: 0;
      min-height: 100svh;
    }`,
    codeFilename: 'src/styles/probe.css',
    configFile: 'stylelint.config.js',
  })

  expect(result.results[0]?.warnings).toEqual([])
})

test('raw token definitions are allowed only in the central token file', async () => {
  const result = await stylelint.lint({
    code: ':root { --space-1: 4px; --text: #fff; }',
    codeFilename: 'src/styles/tokens.css',
    configFile: 'stylelint.config.js',
  })

  expect(result.errored).toBe(false)
})

test.each([
  'top: 12px',
  'right: 1rem',
  'bottom: 2em',
  'left: calc(var(--space-1) + 4px)',
  'grid-template-columns: 380px 1fr',
  'grid-template-rows: repeat(3, 40px)',
  'grid-template-columns: minmax(380px, 1fr)',
  'grid-template: "main side" 40px / 380px 1fr',
  'grid-template-columns: var(--panel-min, 380px) 1fr',
  'transition: opacity 300ms',
  'transition: opacity var(--t-state), transform 300ms',
  'transition-duration: 0.3s',
  'transition-delay: 100ms',
  'animation: pulse 300ms ease infinite',
  'animation-duration: 1s',
  'animation-delay: var(--t-state), 100ms',
  'transition-duration: calc(var(--t-state) + 1ms)',
  'transform: translateY(4px)',
  'transform: translate3d(0, 4px, 0)',
  'transform: translateY(calc(var(--space-1) + 4px))',
  'transform: translateY(var(--space-1, 4px))',
  'translate: 4px 0',
  'transform-origin: 4px 50%',
  'perspective: 400px',
  'transform: matrix(1, 0, 0, 1, 4, 0)',
  'transform: matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 0, 0, 1)',
])('CSS lint rejects untokenized position/grid/motion declaration %s', async (declaration) => {
  const result = await stylelint.lint({
    code: `.example { ${declaration}; }`,
    codeFilename: 'src/styles/probe.css',
    configFile: 'stylelint.config.js',
  })

  expect(result.errored).toBe(true)
  expect(result.results[0]?.warnings.some((warning) => warning.rule.startsWith('declaration-property-'))).toBe(true)
})

test.each([
  'top: var(--space-1)',
  'right: 0',
  'left: 50%',
  'grid-template-columns: var(--panel-min) 1fr',
  'grid-template-columns: repeat(10, minmax(0, 1fr))',
  'grid-template-areas: "main side"',
  'grid-template: "main side" var(--header-height) / var(--panel-min) 1fr',
  'transition: opacity var(--t-state) ease',
  'transition: opacity var(--t-state), transform var(--t-scene)',
  'transition-duration: var(--t-state)',
  'animation: pulse var(--t-scene) linear infinite',
  'animation-delay: var(--t-state)',
  'animation: none',
  'transition: none',
  'transform: translateY(var(--space-1))',
  'transform: translate(-50%, -50%) scale(1.1)',
  'translate: var(--space-1) 0',
  'transform: var(--scene-transform)',
])('CSS lint allows tokenized and structural declaration %s', async (declaration) => {
  const result = await stylelint.lint({
    code: `.example { ${declaration}; }`,
    codeFilename: 'src/styles/probe.css',
    configFile: 'stylelint.config.js',
  })

  expect(result.results[0]?.warnings).toEqual([])
})
