import { lazy } from 'react'
import { AsyncBoundary } from '@/components/AsyncBoundary/AsyncBoundary'
import { Route, Routes, useLocation } from 'react-router'
import { SiteHeader } from '@/components/SiteHeader/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter/SiteFooter'
import { HomeScene } from '@/scenes/home/HomeScene'
import { NotFoundScene } from '@/scenes/NotFoundScene'

const GameScene = lazy(() => import('@/scenes/game/GameScene').then((module) => ({ default: module.GameScene })))

const LibraryScene = lazy(() => import('@/scenes/library/LibraryScene').then((module) => ({ default: module.LibraryScene })))

const AboutScene = lazy(() => import('@/scenes/AboutScene').then((module) => ({ default: module.AboutScene })))

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
