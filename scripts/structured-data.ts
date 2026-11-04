import { gameIds } from '../shared/games/index.ts'
import { SITE_ORIGIN } from '../shared/site.ts'
import { libraryPath } from '../src/lib/paths.ts'
import { en } from '../src/copy/en.ts'

// schema.org JSON-LD for search engines and AI answers: on Home, the site, the game
// (with its three games as parts) and its author; on About, the page about it. Built
// from the app's copy, so it says what the pages say. One @graph per page, with ids
// shared, so each page describes the same game and the same person.

const id = (name: string) => `${SITE_ORIGIN}/#${name}`
const author = {
  '@type': 'Person',
  '@id': id('author'),
  name: 'Ronald Balutiu',
  sameAs: ['https://github.com/ronald-balutiu'],
}

const game = {
  '@type': 'VideoGame',
  '@id': id('game'),
  name: en['app.name'],
  url: `${SITE_ORIGIN}/`,
  description: `${en['about.lede']} ${en['welcome.lede']}`,
  genre: ['Word game', 'Puzzle game'],
  gamePlatform: 'Web browser',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Any',
  inLanguage: 'en',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@id': id('author') },
  hasPart: gameIds.map((game) => ({
    '@type': 'VideoGame',
    name: en[`game.name.${game}`],
    description: en[`game.tagline.${game}`],
    url: `${SITE_ORIGIN}${libraryPath(game)}`,
  })),
}

export function homeStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': id('website'),
        url: `${SITE_ORIGIN}/`,
        name: en['app.name'],
        description: en['meta.title.home'],
        inLanguage: 'en',
        author: { '@id': id('author') },
      },
      game,
      author,
    ],
  }
}

export function aboutStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AboutPage',
        url: `${SITE_ORIGIN}/about`,
        name: en['about.title'],
        description: en['meta.description.about'],
        inLanguage: 'en',
        isPartOf: { '@id': id('website') },
        about: { '@id': id('game') },
        author: { '@id': id('author') },
      },
      game,
      author,
    ],
  }
}

// A data block, not a script: JSON with `<` escaped, so no text inside can close it.
export const jsonLdTag = (data: unknown) =>
  `    <script type="application/ld+json">${JSON.stringify(data).replace(/</gu, '\\u003c')}</script>\n`
