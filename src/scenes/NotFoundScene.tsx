import { Link } from 'react-router'
import { usePageMeta } from '@/app/use-page-meta'
import { AsciiMark } from '@/components/AsciiMark/AsciiMark'
import { en } from '@/copy/en'
import './scenes.css'
import './not-found.css'

// Unknown paths arrive through 404.html with a real 404 status. The code's middle
// digit is the ring mark, turning; it's read as the plain code.
const [first, , last] = en['notFound.code']

export function NotFoundScene() {
  usePageMeta(en['meta.title.notFound'], { indexable: false })
  return (
    <main className="app-frame scene" data-scene="not-found">
      <section className="not-found-content" aria-labelledby="not-found-title">
        <p className="not-found-code">
          <span className="visually-hidden">{en['notFound.code']}</span>
          <span className="not-found-code__digit" aria-hidden="true">{first}</span>
          <AsciiMark />
          <span className="not-found-code__digit" aria-hidden="true">{last}</span>
        </p>
        <h1 id="not-found-title">{en['notFound.title']}</h1>
        <p>{en['notFound.body']}</p>
        <div className="actions"><Link className="pill control-link" to="/play">{en['nav.library']}</Link></div>
      </section>
    </main>
  )
}
