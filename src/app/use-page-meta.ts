import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { SITE_ORIGIN } from '@shared/site'

// Keeps the page's title, canonical URL and indexing current as the app navigates.
// Route pages arrive with the first two already in their HTML (scripts/vite-plugins.ts);
// noindex marks pages that don't exist, such as a puzzle number the library lacks.

function headElement(selector: string, create: () => HTMLElement): HTMLElement {
  return document.head.querySelector<HTMLElement>(selector) ?? document.head.appendChild(create())
}

export function usePageMeta(title: string, { indexable = true }: { indexable?: boolean } = {}) {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    // A lazy scene can mount after the shared header's navigation effect.
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    document.title = title
    const canonical = headElement('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }))
    canonical.setAttribute('href', `${SITE_ORIGIN}${pathname}`)
    const robots = document.head.querySelector('meta[name="robots"]')
    if (indexable) robots?.remove()
    else headElement('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' })).setAttribute('content', 'noindex')
  }, [title, pathname, hash, indexable])
}
