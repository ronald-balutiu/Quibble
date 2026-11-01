import { useId, useSyncExternalStore } from 'react'
import { cloudModels } from '@shared/schemas/judge'
import { en } from '@/copy/en'
import { loadCloudModel, saveCloudModel, subscribeCloudModel } from '@/lib/storage/settings'
import './JudgeSetup.css'

export function CloudModelChoice() {
  const name = useId()
  const model = useSyncExternalStore(subscribeCloudModel, loadCloudModel)
  return (
    <fieldset className="cloud-models">
      <legend>{en['welcome.cloud.title']}</legend>
      {cloudModels.map((option) => (
        <label key={option} htmlFor={`${name}-${option}`} aria-label={en[`judgeChoice.${option}`]} className="cloud-model" data-selected={model === option}>
          <input id={`${name}-${option}`} type="radio" name={name} value={option} checked={model === option} onChange={() => { saveCloudModel(option) }} />
          <span>
            <strong>{en[`judgeChoice.${option}`]}</strong>
            <span>{en[`welcome.cloud.${option}`]}</span>
          </span>
        </label>
      ))}
      <p className="judge-setup__note">{en['welcome.cloud.free']}</p>
    </fieldset>
  )
}
