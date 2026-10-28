// A whole value must consist of token references or explicit structural keywords.
// Anchoring prevents mixed values such as "var(--space-1) 12px" slipping through.
const token = String.raw`var\(\s*--[a-z][a-z0-9-]*\s*\)`
const wide = String.raw`(?:inherit|initial|unset|revert|revert-layer)`
const sequence = (...parts) => {
  const item = `(?:${parts.join('|')})`
  return `/^${item}(?:\\s+${item})*$/i`
}
const colors = sequence(token, wide, 'currentcolor', 'transparent', 'none')
const spacing = sequence(token, wide, 'auto', '0')
const typography = sequence(token, wide)
const lines = sequence(token, wide, '0', 'none', 'auto', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'hidden')
const sizing = sequence(token, wide, '0', 'auto', 'none', 'min-content', 'max-content', 'fit-content', 'stretch', String.raw`\d+(?:\.\d+)?(?:%|[sld]?v[whib])`)

export default {
  ignoreFiles: ['plan/**', 'node_modules/**', 'dist/**'],
  rules: {
    'block-no-empty': true,
    'color-no-invalid-hex': true,
    'declaration-block-no-duplicate-properties': true,
    'property-no-unknown': true,
    'declaration-property-value-allowed-list': [{
      // All custom-property declarations belong in the central token file.
      '/^--/': ['/^$/'],
      '/^(?:color|background(?:-color)?|.*-color|fill|stroke)$/': [colors],
      '/^(?:font(?:-family|-size|-weight)?|line-height|letter-spacing|word-spacing)$/': [typography],
      '/^(?:(?:margin|padding|scroll-margin|scroll-padding|inset)(?:-[a-z-]+)?|gap|row-gap|column-gap)$/': [spacing],
      '/^(?:border(?:-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?(?:-width)?|outline(?:-width)?|stroke-width)$/': [lines],
      '/^(?:border(?:-[a-z-]+)?-radius|outline-offset)$/': [spacing],
      '/^(?:text-shadow|box-shadow)$/': [sequence(token, wide, 'none')],
      '/^(?:(?:min-|max-)?(?:width|height|inline-size|block-size)|flex-basis|top|right|bottom|left)$/': [sizing],
    }, {
      message: 'Use a design token from src/styles/tokens.css; raw color, type, spacing and fixed measurement values are not allowed.',
    }],
    // Parse units inside functions/shorthands too: repeat(), minmax(), calc(),
    // translateY(), and var() fallbacks must not conceal raw lengths or times.
    'declaration-property-unit-allowed-list': {
      '/^grid-template(?:-[a-z-]+)?$/': ['%', 'fr'],
      '/^(?:-webkit-)?(?:transition|animation)(?:-duration|-delay)?$/': [],
      '/^(?:-webkit-)?(?:transform|translate|transform-origin|perspective|perspective-origin)$/': ['%', 'deg', 'grad', 'rad', 'turn'],
    },
    // Matrix translation offsets are implicit pixel lengths without units.
    // Put the complete matrix in a token rather than bypassing the unit check.
    'declaration-property-value-disallowed-list': {
      '/^(?:-webkit-)?transform$/': ['/\\bmatrix(?:3d)?\\s*\\(/i'],
    },
  },
  overrides: [{
    files: ['src/styles/tokens.css'],
    rules: { 'declaration-property-value-allowed-list': null },
  }],
}
