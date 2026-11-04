import { en, format } from '@/copy/en'
import { AboutSection, YesNoCell } from './AboutSection'
import { factory, tableRows, tableRules } from './about-facts'

// 05: where the puzzles come from, told through a slice of the factory's truth table.
export function PuzzleMaking({ n }: { n: number }) {
  return (
    <AboutSection n={n} labelKey="about.puzzles" headingKey="about.puzzles.title">
      <p>{format('about.puzzles.table', { things: factory.things, rules: factory.rules })}</p>
      <div className="about-card about-table">
        <table>
          <caption className="telemetry">{en['about.puzzles.slice']}</caption>
          <thead>
            <tr>
              <th scope="col">{en['about.puzzles.thing']}</th>
              {tableRules.map((rule) => (
                <th key={rule} scope="col">
                  {en[`about.puzzles.rule.${rule}`]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map(({ thing, fits }) => (
              <tr key={thing} className={fits.every(Boolean) ? 'about-table__fits' : undefined}>
                <th scope="row">{en[`about.puzzles.thing.${thing}`]}</th>
                {fits.map((yes, i) => (
                  <YesNoCell key={tableRules[i]} yes={yes} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>{format('about.puzzles.answers', { read: factory.spotChecked })}</p>
      <p className="about__note">{en['about.puzzles.wordnet']}</p>
    </AboutSection>
  )
}
