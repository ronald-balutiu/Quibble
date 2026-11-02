import { en } from '@/copy/en'

interface ComparisonRow {
  label: string
  note: string
  cloud: string
  device: string
}

export function ComparisonTable({ label, cloudName, rows }: { label: string, cloudName: string, rows: ComparisonRow[] }) {
  return (
    <table className="compare-table" aria-label={label}>
      <thead><tr>
        <th scope="col">{en['compare.measure']}</th>
        <th scope="col">{en['compare.cloud']}<strong>{cloudName}</strong></th>
        <th scope="col">{en['compare.local']}<strong>{en['device.model']}</strong></th>
      </tr></thead>
      <tbody>{rows.map((row) => (
        <tr key={row.label}>
          <th scope="row">{row.label}<small>{row.note}</small></th>
          <td>{row.cloud}</td><td>{row.device}</td>
        </tr>
      ))}</tbody>
    </table>
  )
}
