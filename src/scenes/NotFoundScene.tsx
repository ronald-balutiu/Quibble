import { Link } from 'react-router'
import { usePageMeta } from '@/app/use-page-meta'
import { en } from '@/copy/en'
import './scenes.css'
import './not-found.css'

// Unknown paths arrive through 404.html with a real 404 status.
export function NotFoundScene() {
  usePageMeta(en['meta.title.notFound'], { indexable: false })
  return (
    <main className="app-frame scene" data-scene="not-found">
      <section className="not-found-content" aria-labelledby="not-found-title">
        <p className="telemetry">{en['notFound.code']}</p>
        <h1 id="not-found-title">{en['notFound.title']}</h1>
        <p>{en['notFound.body']}</p>
        <div className="actions"><Link className="pill control-link" to="/play">{en['nav.library']}</Link></div>
      </section>
    </main>
  )
}
