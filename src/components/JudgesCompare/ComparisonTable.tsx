import { en } from '@/copy/en'

// The two judges side by side (5.5 H3): each measure is a row of paired bars, a dot
// for the cloud judge and a ring for the local one, as in the headline. The numbers
// stay in the cells, so the bars are decorative and the table reads the same
// without them. The better value of a row is marked in text, not only by weight.

type Judge = 'cloud' | 'device'

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

export function JudgeMarker({ judge }: { judge: Judge }) {
  return (
    <svg className={`judge-marker judge-marker--${judge}`} viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="4" strokeWidth="1.5" />
    </svg>
  )
}

// A line from zero to the value, ending in the judge's marker; `both` (agreement
// between the judges) has no marker.
export function JudgeBar({ judge, value }: { judge: Judge | 'both'; value: number }) {
  const x = `${String(Math.round(Math.min(1, Math.max(0, value)) * 1000) / 10)}%`
  return (
    <svg className={`judge-bar judge-bar--${judge}`} aria-hidden="true">
      <line className="judge-bar__track" x1="0" x2="100%" y1="50%" y2="50%" strokeWidth="1" />
      <line className="judge-bar__value" x1="0" x2={x} y1="50%" y2="50%" strokeWidth="2" />
      {judge !== 'both' && <circle className="judge-bar__marker" cx={x} cy="50%" r="4" strokeWidth="1.5" />}
    </svg>
  )
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
