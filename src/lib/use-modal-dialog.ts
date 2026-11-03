import { useEffect, useRef } from 'react'

// A native <dialog> opened as a modal on mount, so focus moves into it and the page
// behind it is inert until it closes.
export function useModalDialog() {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return dialog
}
