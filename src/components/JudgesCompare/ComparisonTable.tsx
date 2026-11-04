import { JudgeBar, JudgeMarker, type Judge } from '@/components/JudgeBar/JudgeBar'
import { en } from '@/copy/en'

// The two judges side by side (5.5 H3): each measure is a row of paired bars, a dot
// for the cloud judge and a ring for the local one, as in the headline. The numbers
// stay in the cells, so the bars are decorative and the table reads the same
// without them. The better value of a row is marked in text, not only by weight.

interface ComparisonRow {
  label: string
  note: string
  cloud: string
  device: string
  // Bar lengths, as fractions of `max`. Left out where a bar says nothing (cost).
  bars?: { cloud: number; device: number; max: number }
  better?: 'higher' | 'lower'
}

export interface ComparisonGroup {
  title: string
  rows: ComparisonRow[]
}

function winner({ bars, better }: ComparisonRow): Judge | undefined {
  if (!bars || !better || bars.cloud === bars.device) return undefined
  return bars.cloud < bars.device === (better === 'lower') ? 'cloud' : 'device'
}

export function ComparisonTable({
  label,
  cloudName,
  groups,
}: {
  label: string
  cloudName: string
  groups: ComparisonGroup[]
}) {
  return (
    <table className="compare-table" aria-label={label}>
      <thead>
        <tr>
          <th scope="col">{en['compare.measure']}</th>
          <th scope="col">
            <span>{en['compare.cloud']}</span>
            <strong>
              <JudgeMarker judge="cloud" />
              {cloudName}
            </strong>
          </th>
          <th scope="col">
            <span>{en['compare.local']}</span>
            <strong>
              <JudgeMarker judge="device" />
              {en['device.model']}
            </strong>
          </th>
        </tr>
      </thead>
      {groups.map((group) => (
        <tbody key={group.title}>
          <tr className="compare-table__group">
            <th scope="colgroup" colSpan={3}>
              {group.title}
            </th>
          </tr>
          {group.rows.map((row) => {
            const best = winner(row)
            return (
              <tr key={row.label}>
                <th scope="row">
                  {row.label}
                  <small>{row.note}</small>
                </th>
                {(['cloud', 'device'] as const).map((judge) => (
                  <td key={judge} className={best === judge ? 'compare-table__better' : undefined}>
                    {row[judge]}
                    {best === judge && <span className="visually-hidden">{en['compare.better']}</span>}
                    {row.bars && (
                      <JudgeBar judge={judge} value={row.bars[judge] / Math.max(row.bars.max, Number.EPSILON)} />
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      ))}
    </table>
  )
}
