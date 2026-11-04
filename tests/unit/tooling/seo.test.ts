import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { gameIds } from '@shared/games'
import { evalResultsSchema } from '@shared/schemas/eval-results'
import { SITE_ORIGIN } from '@shared/site'
import { llmsTxt } from '../../../scripts/llms-txt'
import { aboutStructuredData, homeStructuredData, jsonLdTag } from '../../../scripts/structured-data'

// The build's guides for search engines and AI tools: llms.txt and JSON-LD.

const results = evalResultsSchema.parse(JSON.parse(readFileSync('public/eval/results.json', 'utf8')))
const counts = { 'oddly-specific': 100, 'category-escape': 100, 'double-agent': 56 }

describe('llms.txt', () => {
  const text = llmsTxt(counts, results)

  test('opens with the site name and summary, and links every game and page', () => {
    expect(text.startsWith('# Quibble\n\n> Word games where you can argue with the referee.')).toBe(true)
    for (const game of gameIds) expect(text).toContain(`${SITE_ORIGIN}/play?game=${game}`)
    expect(text).toContain('56 puzzles.')
    for (const path of ['/', '/play', '/about']) expect(text).toContain(`](${SITE_ORIGIN}${path})`)
  })

  test('states the published test results', () => {
    expect(text).toContain(`same sealed test of ${String(results.test.cases)} guesses`)
    expect(text).toContain(`Gemma 4 ${((results.test.judges['gemma-4']?.wholeGuess.value ?? 0) * 100).toFixed(1)}%`)
    expect(text).toContain(`target of ${(results.target.wholeGuess * 100).toFixed(1)}%`)
  })
})

describe('structured data', () => {
  test('Home describes the site, the game with its three games, and its author, by shared ids', () => {
    const graph = homeStructuredData()['@graph']
    expect(graph.map((node) => node['@type'])).toEqual(['WebSite', 'VideoGame', 'Person'])
    const game = graph[1] as { hasPart: { name: string }[]; isAccessibleForFree: boolean; '@id': string }
    expect(game.hasPart.map(({ name }) => name)).toEqual(['Oddly Specific', 'Category Escape', 'Double Agent'])
    expect(game.isAccessibleForFree).toBe(true)
    const about = aboutStructuredData()['@graph'][0] as { '@type': string; about: { '@id': string }; url: string }
    expect(about).toMatchObject({ '@type': 'AboutPage', url: `${SITE_ORIGIN}/about` })
    expect(about.about['@id']).toBe(game['@id'])
  })

  test('is a JSON data block that no text inside can close', () => {
    const tag = jsonLdTag({ name: '</script><b>' })
    expect(tag).toContain('<script type="application/ld+json">')
    expect(tag).not.toContain('</script><b>')
    expect(JSON.parse(/>(.*)<\/script>/u.exec(tag)?.[1] ?? '')).toEqual({ name: '</script><b>' })
  })
})
