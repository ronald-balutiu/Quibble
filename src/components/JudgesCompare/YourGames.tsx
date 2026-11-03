import { useMemo } from 'react'
import { en, format } from '@/copy/en'
import { comparisonChanges, loadComparisons } from '@/lib/storage/comparisons'
import { useStorageRevision } from '@/lib/use-storage-revision'
import { yourGames } from '@/lib/your-games'
import { ComparisonTable, JudgeBar, type ComparisonGroup } from './ComparisonTable'
import { milliseconds, percent } from './format'

export function YourGames() {
  const revision = useStorageRevision(comparisonChanges)
  // Parsing and aggregation only repeat when the stored history changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the revision invalidates derived storage data after local or cross-tab changes.
  const mine = useMemo(() => yourGames(loadComparisons()), [revision])
  if (mine.guesses === 0)
    return (
      <div className="compare__empty">
        <h3 className="compare__question">{en['compare.empty']}</h3>
        <p>{en['compare.empty.body']}</p>
        <details className="compare-disclosure">
          <summary>{en['compare.empty.how']}</summary>
          <p>{en['compare.empty.setup']}</p>
        </details>
      </div>
    )

  const stricter =
    mine.cloudStricter === mine.deviceStricter ? 'even' : mine.cloudStricter > mine.deviceStricter ? 'cloud' : 'device'
  const { cloudMedianMs: cloudMs, deviceMedianMs: deviceMs } = mine
  const groups: ComparisonGroup[] = [
    {
      title: en['compare.group.splits'],
      rows: [
        {
          label: en['compare.stricter'],
          note: format(`compare.stricter.${stricter}`, {
            n: Math.max(mine.cloudStricter, mine.deviceStricter),
            splits: mine.splits,
          }),
          cloud: String(mine.cloudStricter),
          device: String(mine.deviceStricter),
          bars: { cloud: mine.cloudStricter, device: mine.deviceStricter, max: mine.splits },
        },
      ],
    },
    {
      title: en['compare.group.you'],
      rows: [
        {
          label: en['compare.overruled'],
          note: en['compare.overruled.note'],
          cloud: String(mine.overruled.cloud),
          device: String(mine.overruled.device),
          bars: {
            cloud: mine.overruled.cloud,
            device: mine.overruled.device,
            max: Math.max(mine.overruled.cloud, mine.overruled.device),
          },
        },
      ],
    },
    {
      title: en['compare.group.speed'],
      rows: [
        {
          label: en['compare.speed'],
          note: en['compare.yourSpeed.note'],
          cloud: milliseconds(cloudMs),
          device: milliseconds(deviceMs),
          better: 'lower',
          ...(cloudMs !== undefined &&
            deviceMs !== undefined && { bars: { cloud: cloudMs, device: deviceMs, max: Math.max(cloudMs, deviceMs) } }),
        },
      ],
    },
  ]
  const agreement = [
    {
      label: en['compare.agreedGuess'],
      share: mine.agreedGuesses / mine.guesses,
      count: format('compare.guessCount', { n: mine.agreedGuesses, total: mine.guesses }),
    },
    {
      label: en['compare.agreedCondition'],
      share: mine.agreedConditions / Math.max(1, mine.conditions),
      count: format('compare.ruleCount', { n: mine.agreedConditions, total: mine.conditions }),
    },
  ]
  return (
    <div className="compare__personal">
      <p className="compare__meta">{format('compare.yours', { n: mine.guesses.toLocaleString() })}</p>
      <h3 className="compare__question">{en['compare.yourQuestion']}</h3>
      <p className="compare__muted">{en['compare.yours.body']}</p>
      <dl className="compare__summary">
        {agreement.map(({ label, share, count }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {percent(share)}
              <JudgeBar judge="both" value={share} />
              <small>{count}</small>
            </dd>
          </div>
        ))}
      </dl>
      <p className="compare__takeaway">{en['compare.agreement.note']}</p>
      <h3 className="compare__question compare__personal-title">{en['compare.differences']}</h3>
      <p className="compare__muted">{format('compare.differences.body', { n: mine.splits })}</p>
      <ComparisonTable label={en['compare.yourTable']} cloudName={en['compare.allCloudModels']} groups={groups} />
      <p className="compare__footnote">{en['compare.history.note']}</p>
    </div>
  )
}
