import { StrictMode } from 'react'
import { prerender } from 'react-dom/static'
import { StaticRouter } from 'react-router'
import { App } from '@/app/App'

// Build-time rendering (scripts/prerender.ts): each route's page ships with its
// first screen already in the HTML, and src/main.tsx hydrates it. It waits for the
// lazy screens; data and saved progress load after hydration, as on the client.
export async function render(path: string): Promise<string> {
  const { prelude } = await prerender(
    <StrictMode>
      <StaticRouter location={path}>
        <App />
      </StaticRouter>
    </StrictMode>,
  )
  return new Response(prelude).text()
}
