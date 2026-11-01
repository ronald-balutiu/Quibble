import { Route, Routes } from 'react-router'
import { SiteHeader } from '@/components/SiteHeader/SiteHeader'
import { GameScene } from '@/scenes/game/GameScene'
import { HomeScene } from '@/scenes/home/HomeScene'
import { LibraryScene } from '@/scenes/library/LibraryScene'
import { AboutScene } from '@/scenes/AboutScene'
import { NotFoundScene } from '@/scenes/NotFoundScene'

// The planned routes only (D-37).
export function App() {
  return (
    <>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<HomeScene />} />
        <Route path="/play" element={<LibraryScene />} />
        <Route path="/play/:game/:n" element={<GameScene />} />
        <Route path="/about" element={<AboutScene />} />
        <Route path="*" element={<NotFoundScene />} />
      </Routes>
    </>
  )
}
