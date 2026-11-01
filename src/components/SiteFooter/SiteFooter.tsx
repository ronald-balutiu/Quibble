import { en } from '@/copy/en'
import './site-footer.css'

export function SiteFooter() {
  return (
    <footer className="site-footer telemetry">
      <span>{en['footer.tagline']}</span>
      <span>{en['footer.copyright']}</span>
    </footer>
  )
}
