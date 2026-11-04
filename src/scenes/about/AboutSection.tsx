import type { ReactNode } from 'react'
import { en, format, type CopyKey } from '@/copy/en'

// A numbered label above each About section's heading; without a heading, the label
// is one.
export function AboutSection({
  n,
  labelKey,
  headingKey,
  id,
  children,
}: {
  n: number
  labelKey: CopyKey
  headingKey?: CopyKey
  id?: string
  children: ReactNode
}) {
  const heading = `about-${String(n)}`
  const eyebrow = format('about.section', { n: String(n).padStart(2, '0'), label: en[labelKey] })
  return (
    <section id={id} className="about__section" aria-labelledby={heading}>
      {headingKey ? (
        <>
          <p className="telemetry">{eyebrow}</p>
          <h2 id={heading}>{en[headingKey]}</h2>
        </>
      ) : (
        <h2 id={heading} className="telemetry">
          {eyebrow}
        </h2>
      )}
      {children}
    </section>
  )
}

// A yes or no in the example tally and the truth table, coloured like a verdict.
export function YesNoCell({ yes }: { yes: boolean }) {
  return <td className={yes ? 'about-yes' : 'about-no'}>{en[yes ? 'about.you.yes' : 'about.you.no']}</td>
}
