import type { GameId } from '@shared/games'

// The app's route paths (src/app/App.tsx), for links, navigation and the build
// plugins' route pages and sitemap.
export const puzzlePath = (game: GameId, n: number) => `/play/${game}/${String(n)}`
export const libraryPath = (game?: GameId) => (game ? `/play?game=${game}` : '/play')
