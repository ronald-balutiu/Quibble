import { lazy, useId, useState } from 'react'
import { AsyncBoundary } from '@/components/AsyncBoundary/AsyncBoundary'
import { en } from '@/copy/en'
import './JudgesCompare.css'

const ComparisonContent = lazy(() => import('./ComparisonContent').then((module) => ({ default: module.ComparisonContent })))

// Defer the data and detailed UI until first opened. Keep it mounted afterward
// so collapsing the section preserves the chosen source and model preview.
export function JudgesCompare({ collapsible = false }: { collapsible?: boolean }) {
  const id = useId()
  const [opened, setOpened] = useState(false)
  const content = <AsyncBoundary loading={en['compare.loading']}><ComparisonContent /></AsyncBoundary>
  return (
    <section className="compare" aria-labelledby={`${id}-title`}>
      <header className="compare__head">
        <h2 id={`${id}-title`}>{en['compare.title']}</h2>
        <p>{en['compare.intro']}</p>
      </header>
      {collapsible
        ? <details className="compare__disclosure" onToggle={(event) => { if (event.currentTarget.open) setOpened(true) }}><summary>{en['compare.expand']}</summary>{opened && content}</details>
        : content}
    </section>
  )
}
