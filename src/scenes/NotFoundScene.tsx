import { Link } from 'react-router'
import { en } from '@/copy/en'
import './scenes.css'

// P2: an unknown path. The Worker's SPA fallback serves the app for every URL.
export function NotFoundScene() {
  return (
    <main className="app-frame scene" data-scene="not-found">
      <h1>{en['notFound.title']}</h1>
      <p>{en['notFound.body']}</p>
      <Link className="pill control-link" to="/play">{en['nav.library']}</Link>
    </main>
  )
}
