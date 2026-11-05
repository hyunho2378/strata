import { useMemo, useSyncExternalStore } from 'react'

export default function useMediaQuery(query) {
  const [subscribe, getSnapshot] = useMemo(() => {
    const mql = window.matchMedia(query)
    return [
      (cb) => { mql.addEventListener('change', cb); return () => mql.removeEventListener('change', cb) },
      () => mql.matches
    ]
  }, [query])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
