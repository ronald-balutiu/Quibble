import { en } from '@/copy/en'
import { AboutSection, YesNoCell } from './AboutSection'

// 03: what the tally of your games shows, with an example of one.

const tally = [
  { guess: 'about.you.row.teaspoon', cloud: true, local: true, you: 'about.you.row.teaspoon.you' },
  { guess: 'about.you.row.duck', cloud: false, local: true, you: 'about.you.row.duck.you' },
  { guess: 'about.you.row.glowstick', cloud: true, local: false, you: 'about.you.row.glowstick.you' },
] as const

const columns = ['about.you.guess', 'about.you.cloud', 'about.you.local', 'about.you.you'] as const

export function YouVsJudges({ n }: { n: number }) {
  return (
    <AboutSection n={n} labelKey="about.you" headingKey="about.you.title">
      <p>{en['about.you.body']}</p>
      <div className="about-card about-table">
        <table>
          <caption className="telemetry">{en['about.you.example']}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {en[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tally.map((row) => (
              <tr key={row.guess}>
                <th scope="row">{en[row.guess]}</th>
                <YesNoCell yes={row.cloud} />
                <YesNoCell yes={row.local} />
                <td>{en[row.you]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="about__note">
        {en['about.you.start']} <strong>{en['about.you.where']}</strong> {en['about.you.home']}
      </p>
    </AboutSection>
  )
}
