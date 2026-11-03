import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@/styles/fonts.css'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/utilities.css'
import { App } from '@/app/App'

const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

// Route pages arrive prerendered (scripts/prerender.ts), so React attaches to that
// HTML. 404.html, served for unknown paths, is empty and renders from scratch.
const root = document.getElementById('root')
if (!root) throw new Error('The page has no #root element to render into.')
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
