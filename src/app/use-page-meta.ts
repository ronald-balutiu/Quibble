import { useEffect } from 'react'
import { useLocation } from 'react-router'

// What search engines read once the app has rendered: the page's title, its
// canonical URL on the one public origin, and noindex for pages that don't exist
// (the Worker's single-page fallback serves those with a 200).
const ORIGIN = 'https://quibble.ronaldbalutiu.com'

function headElement(selector: string, create: () => HTMLElement): HTMLElement {
  return document.head.querySelector<HTMLElement>(selector) ?? document.head.appendChild(create())
}

export function usePageMeta(title: string, { indexable = true }: { indexable?: boolean } = {}) {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = title
    const canonical = headElement('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }))
    canonical.setAttribute('href', `${ORIGIN}${pathname}`)
    const robots = document.head.querySelector('meta[name="robots"]')
    if (indexable) robots?.remove()
    else headElement('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' })).setAttribute('content', 'noindex')
  }, [title, pathname, indexable])
}
