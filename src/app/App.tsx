import { Route, Routes } from 'react-router'
import { GameScene } from '@/scenes/game/GameScene'
import { HomeScene } from '@/scenes/home/HomeScene'
import { LibraryScene } from '@/scenes/library/LibraryScene'
import { NotFoundScene } from '@/scenes/NotFoundScene'

// The planned routes only (D-37). /about (P1) is built in a later phase and
// falls through to the not-found scene until then.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScene />} />
      <Route path="/play" element={<LibraryScene />} />
      <Route path="/play/:game/:n" element={<GameScene />} />
      <Route path="*" element={<NotFoundScene />} />
    </Routes>
  )
}
