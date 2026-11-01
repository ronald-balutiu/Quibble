import { useEffect } from 'react'
import { matchPath, NavLink, useLocation, useNavigate } from 'react-router'
import { gameIds } from '@shared/games'
import { en } from '@/copy/en'
import { SettingsButton } from '../SettingsDrawer/SettingsDrawer'
import './site-header.css'

// Site navigation stays outside the scene frame, including loading and error states.
export function SiteHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const puzzle = matchPath('/play/:game/:n', location.pathname)
  const selected = location.pathname === '/play' ? new URLSearchParams(location.search).get('game') : puzzle?.params.game
  const game = gameIds.find((id) => id === selected)
  const library = game ? `/play?game=${game}` : '/play'

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [location.key, location.hash])

  return (
    <header className="site-header">
      <NavLink className="site-header__brand control-link" to="/?home=1" aria-label={en['nav.brand']}>{en['app.name']}</NavLink>
      <nav className="site-header__nav" aria-label={en['nav.main']}>
        <NavLink className="control-link" to="/?home=1" end>{en['nav.home']}</NavLink>
        <NavLink className="control-link" to={library}>{en['nav.library']}</NavLink>
        <NavLink className="control-link" to="/about">{en['nav.about']}</NavLink>
      </nav>
      {/* A navigation closes the drawer, including its Privacy link on About. */}
      <SettingsButton key={location.key} onProgressCleared={() => {
        // Leave an active run so it cannot save itself again after being deleted.
        if (puzzle) void navigate(library)
      }} />
    </header>
  )
}
