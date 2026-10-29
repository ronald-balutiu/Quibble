import js from '@eslint/js'
import { fixupPluginRules } from '@eslint/compat'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import jsxA11y from 'eslint-plugin-jsx-a11y-x'
import tseslint from 'typescript-eslint'

const privateImports = {
  regex: '(^|/)(worker|factory|eval|plan)(/|$)',
  message: 'Keep server-only data, build-time tools, and planning files out of browser/shared code.',
}

const reactImports = {
  group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  message: 'Keep shared contracts and game reducers independent of React.',
}

const copyAttribute = 'JSXAttribute[name.name=/^(aria-label|aria-description|alt|title|placeholder|label|children)$/]'
const styleAttribute = 'JSXAttribute[name.name="style"]'

export default defineConfig(
  globalIgnores([
    'dist/**',
    'node_modules/**',
    '.wrangler/**',
    'plan/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    '**/.venv/**',
  ]),
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: { eqeqeq: ['error', 'always'] },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      // Use the same referenced TypeScript projects as the editor/typecheck.
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [jsxA11y.configs.recommended],
    languageOptions: { globals: globals.browser },
    // The original React plugin still declares ESLint <=9. Compat adapts its
    // legacy rule APIs; the peer override in package.json keeps one ESLint 10.
    plugins: {
      react: fixupPluginRules(react),
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: { 'jsx-a11y-x': { components: { Link: 'a', NavLink: 'a' } } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      // Structural props (className, route paths, etc.) may remain literals.
      'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: true }],
      'react/forbid-dom-props': ['error', {
        forbid: [{ propName: 'style', message: 'Use CSS classes and design tokens. Dynamic custom properties need a narrowly scoped, documented exception.' }],
      }],
      // A wrapper component must not become another path for inline styles.
      'react/forbid-component-props': ['error', { forbid: ['style'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: `${copyAttribute} > Literal`,
          message: 'Visible and accessible text must come from src/copy/en.ts.',
        },
        {
          selector: `${copyAttribute} > JSXExpressionContainer > :matches(Literal, TemplateLiteral)`,
          message: 'Visible and accessible text must come from src/copy/en.ts.',
        },
        // These guards remain active when an individual dynamic style site
        // justifiably disables forbid-dom-props/forbid-component-props.
        {
          selector: `${styleAttribute} > Literal, ${styleAttribute} > JSXExpressionContainer > :not(ObjectExpression):not(TSAsExpression):not(TSSatisfiesExpression)`,
          message: 'A dynamic style exception must use an explicit object of CSS custom properties, not a string or opaque style variable.',
        },
        {
          selector: `${styleAttribute} > JSXExpressionContainer > :matches(TSAsExpression, TSSatisfiesExpression):not([expression.type="ObjectExpression"])`,
          message: 'A dynamic style exception must use an explicit object of CSS custom properties.',
        },
        {
          selector: `${styleAttribute} ObjectExpression > Property:not([key.type="Literal"][key.value=/^--[a-z][a-z0-9-]*$/]), ${styleAttribute} ObjectExpression > SpreadElement`,
          message: 'Dynamic style exceptions may only set literal CSS custom-property keys (--name); CSS properties and spreads are forbidden.',
        },
        {
          selector: `${styleAttribute} ObjectExpression > :matches(Property[value.type="Literal"], Property[value.type="TemplateLiteral"][value.expressions.length=0], Property[value.type="UnaryExpression"][value.argument.type="Literal"])`,
          message: 'Inline custom-property values must be dynamic; put static values in tokens.css.',
        },
      ],
      'jsx-a11y-x/anchor-is-valid': ['error', {
        components: ['Link', 'NavLink'],
        specialLink: ['to'],
        aspects: ['invalidHref', 'preferButton'],
      }],
      'no-restricted-imports': ['error', { patterns: [privateImports] }],
    },
  },
  {
    files: ['*.config.ts', 'scripts/**/*.ts', 'factory/**/*.ts', 'eval/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['worker/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/*', '**/src/**'], message: 'Import platform-independent code from shared/ instead of the React app.' },
          { regex: '(^|/)(factory|eval|plan)(/|$)', message: 'The production Worker must not import build-time tools or local planning files.' },
        ],
      }],
    },
  },
  {
    files: ['shared/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          privateImports,
          reactImports,
          { group: ['@/*', '**/src/**', 'node:*'], message: 'Shared code must stay independent of the app and platform adapters.' },
        ],
      }],
    },
  },
  {
    files: ['src/games/**/reducer.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          privateImports,
          reactImports,
          { group: ['node:*'], message: 'Game reducers must stay independent of Node APIs.' },
        ],
      }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/storage/**'],
    rules: {
      'no-restricted-globals': ['error', {
        globals: [{ name: 'localStorage', message: 'Use a guarded helper from src/lib/storage/.' }],
        checkGlobalObject: true,
        globalObjects: ['window', 'globalThis', 'self'],
      }],
    },
  },
)
