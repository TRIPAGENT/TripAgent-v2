import { useEffect, useState } from 'react'
import { fetchPlacePhoto, type PlacePhoto } from './agentClient'

/** Resolve on mount, retaining only the displayed result; never persist Google URLs. */
export function usePlacePhoto(query?: string | null, expectedName?: string): PlacePhoto | null {
  const [result, setResult] = useState<{ query: string; expectedName?: string; photo: PlacePhoto | null } | null>(null)
  useEffect(() => {
    if (!query?.trim()) return
    let alive = true
    void fetchPlacePhoto(query, 1200, expectedName).then(photo => { if (alive) setResult({ query, expectedName, photo }) })
    return () => { alive = false }
  }, [query, expectedName])
  return result?.query === query && result?.expectedName === expectedName ? result?.photo ?? null : null
}
