import { useState } from 'react'
import { AsyncBoundary } from '@/components/AsyncBoundary/AsyncBoundary'
import { en } from '@/copy/en'
import { lazyNamed } from '@/lib/lazy-named'
import { useModalDialog } from '@/lib/use-modal-dialog'
import './SettingsDrawer.css'

const SettingsContents = lazyNamed(() => import('./SettingsContents'), 'SettingsContents')

export function SettingsButton({ onProgressCleared }: { onProgressCleared: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="settings-open"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true)
        }}
      >
        {en['settings.open']}
      </button>
      {open && (
        <SettingsDialog
          onClose={() => {
            setOpen(false)
          }}
          onProgressCleared={onProgressCleared}
        />
      )}
    </>
  )
}

function SettingsDialog({ onClose, onProgressCleared }: { onClose: () => void; onProgressCleared: () => void }) {
  const dialog = useModalDialog()
  return (
    <dialog ref={dialog} className="drawer" aria-labelledby="drawer-title" onClose={onClose}>
      <header className="drawer__header">
        <h2 id="drawer-title" className="drawer__title">
          {en['settings.title']}
        </h2>
        <button
          type="button"
          className="drawer__close"
          aria-label={en['sheet.close']}
          onClick={() => {
            dialog.current?.close()
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeWidth="2" />
          </svg>
        </button>
      </header>
      <div className="drawer__body">
        <AsyncBoundary>
          <SettingsContents onProgressCleared={onProgressCleared} />
        </AsyncBoundary>
      </div>
    </dialog>
  )
}
