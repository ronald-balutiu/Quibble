// Wait for work that may not support cancellation itself. Callers also pass the
// signal to the underlying operation when it does, so an aborted wait frees I/O.
export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      reject(signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'))
    }
    if (signal.aborted) {
      // Attach handlers even when already aborted: a late rejection is still owned.
      void work.catch(() => undefined)
      abort()
      return
    }
    signal.addEventListener('abort', abort, { once: true })
    void work.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort)
    })
  })
}
