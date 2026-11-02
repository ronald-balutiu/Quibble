import { useMemo, useSyncExternalStore } from 'react'
import { en, format } from '@/copy/en'
import { comparisonChanges, loadComparisons } from '@/lib/storage/comparisons'
import { yourGames } from '@/lib/your-games'
import { ComparisonTable } from './ComparisonTable'
import { milliseconds, percent } from './format'

export function YourGames() {
  const revision = useSyncExternalStore(comparisonChanges.subscribe, comparisonChanges.snapshot)
  // Parsing and aggregation only repeat when the stored history changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the revision invalidates derived storage data after local or cross-tab changes.
  const mine = useMemo(() => yourGames(loadComparisons()), [revision])
  if (mine.guesses === 0) return (
    <div className="compare__empty">
      <h3 className="compare__question">{en['compare.empty']}</h3>
      <p>{en['compare.empty.body']}</p>
      <details className="compare-disclosure"><summary>{en['compare.empty.how']}</summary><p>{en['compare.empty.setup']}</p></details>
    </div>
  )

  const stricter = mine.cloudStricter === mine.deviceStricter ? 'even' : mine.cloudStricter > mine.deviceStricter ? 'cloud' : 'device'
  const rows = [
    { label: en['compare.stricter'], note: format(`compare.stricter.${stricter}`, { n: Math.max(mine.cloudStricter, mine.deviceStricter), splits: mine.splits }), cloud: String(mine.cloudStricter), device: String(mine.deviceStricter) },
    { label: en['compare.overruled'], note: en['compare.overruled.note'], cloud: String(mine.overruled.cloud), device: String(mine.overruled.device) },
    { label: en['compare.speed'], note: en['compare.yourSpeed.note'], cloud: milliseconds(mine.cloudMedianMs), device: milliseconds(mine.deviceMedianMs) },
  ]
  return (
    <div className="compare__personal">
      <p className="compare__meta">{format('compare.yours', { n: mine.guesses.toLocaleString() })}</p>
      <h3 className="compare__question">{en['compare.yourQuestion']}</h3>
      <p className="compare__muted">{en['compare.yours.body']}</p>
      <dl className="compare__summary">
        <div><dt>{en['compare.agreedGuess']}</dt><dd>{percent(mine.agreedGuesses / mine.guesses)}<small>{format('compare.guessCount', { n: mine.agreedGuesses, total: mine.guesses })}</small></dd></div>
        <div><dt>{en['compare.agreedCondition']}</dt><dd>{percent(mine.agreedConditions / Math.max(1, mine.conditions))}<small>{format('compare.ruleCount', { n: mine.agreedConditions, total: mine.conditions })}</small></dd></div>
      </dl>
      <p className="compare__takeaway">{en['compare.agreement.note']}</p>
      <h3 className="compare__question compare__personal-title">{en['compare.differences']}</h3>
      <p className="compare__muted">{format('compare.differences.body', { n: mine.splits })}</p>
      <ComparisonTable label={en['compare.yourTable']} cloudName={en['compare.allCloudModels']} rows={rows} />
      <p className="compare__footnote">{en['compare.history.note']}</p>
    </div>
  )
}
