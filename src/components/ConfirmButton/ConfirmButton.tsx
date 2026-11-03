import { useEffect, useRef, useState } from 'react'
import { en } from '@/copy/en'

// Every clear, reset and delete asks once more in place (D-28): "Press again" for
// 5 s, then "Deleted" (5.7 confirm.again).
export function ConfirmButton({
  label,
  danger = false,
  onConfirm,
}: {
  label: string
  danger?: boolean
  onConfirm: () => void
}) {
  const [state, setState] = useState<'idle' | 'confirming' | 'done'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )
  function press() {
    if (state === 'idle') {
      setState('confirming')
      timer.current = setTimeout(() => {
        setState('idle')
      }, 5000)
      return
    }
    clearTimeout(timer.current)
    onConfirm()
    setState('done')
  }
  return (
    <button
      type="button"
      className={danger ? 'pill pill--quiet pill--danger' : 'pill pill--quiet'}
      disabled={state === 'done'}
      onClick={press}
    >
      {state === 'idle' ? label : en[state === 'confirming' ? 'confirm.again' : 'confirm.done']}
    </button>
  )
}
