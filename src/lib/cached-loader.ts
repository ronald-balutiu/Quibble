// Share in-flight work and successful static data for this page visit. A failed
// request is evicted so another mount or an explicit retry can recover.
export function cachedLoader<T>(load: () => Promise<T | undefined>): () => Promise<T | undefined> {
  let request: Promise<T | undefined> | undefined
  return () => {
    request ??= Promise.resolve().then(load).catch(() => undefined).then((value) => {
      if (value === undefined) request = undefined
      return value
    })
    return request
  }
}
