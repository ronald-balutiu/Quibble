import { AsyncBoundary } from '@/components/AsyncBoundary/AsyncBoundary'
import { Route, Routes, useLocation } from 'react-router'
import { SiteHeader } from '@/components/SiteHeader/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter/SiteFooter'
import { lazyNamed } from '@/lib/lazy-named'
import { HomeScene } from '@/scenes/home/HomeScene'
import { NotFoundScene } from '@/scenes/NotFoundScene'

const GameScene = lazyNamed(() => import('@/scenes/game/GameScene'), 'GameScene')
const LibraryScene = lazyNamed(() => import('@/scenes/library/LibraryScene'), 'LibraryScene')
const AboutScene = lazyNamed(() => import('@/scenes/about/AboutScene'), 'AboutScene')

// The planned routes only (D-37).
export function App() {
  const { pathname } = useLocation()
  return (
    <>
      <SiteHeader />
      <AsyncBoundary key={pathname} page>
        <Routes>
          <Route path="/" element={<HomeScene />} />
          <Route path="/play" element={<LibraryScene />} />
          <Route path="/play/:game/:n" element={<GameScene />} />
          <Route path="/about" element={<AboutScene />} />
          <Route path="*" element={<NotFoundScene />} />
        </Routes>
      </AsyncBoundary>
      <SiteFooter />
    </>
  )
}
