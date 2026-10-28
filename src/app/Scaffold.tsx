import { en } from '@/copy/en'

interface ScaffoldProps {
  scene: 'home' | 'library' | 'game' | 'about' | 'not-found'
}

// Infrastructure placeholder, not the product screen for any of these scenes.
export function Scaffold({ scene }: ScaffoldProps) {
  return (
    <main className="app-frame" data-scene={scene}>
      <h1>{en['app.name']}</h1>
      <p>{en['home.title']}</p>
    </main>
  )
}
