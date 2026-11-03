// Formatting for code and CSS (npm run format). Matches the existing style: no
// semicolons, single quotes, trailing commas. Lint checks it (npm run lint).
/** @type {import('prettier').Config} */
export default {
  printWidth: 120,
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
}
