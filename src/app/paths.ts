import type { GameId } from '@shared/games'

// The app's route paths (App.tsx), for links and navigation.
export const puzzlePath = (game: GameId, n: number) => `/play/${game}/${String(n)}`
export const libraryPath = (game?: GameId) => (game ? `/play?game=${game}` : '/play')
