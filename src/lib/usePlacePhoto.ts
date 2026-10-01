import { useEffect, useState } from 'react'
import { fetchPlacePhoto, type PlacePhoto } from './agentClient'

/**
 * One in-memory resolution per place, per session.
 *
 * The agent caches these on its disk too, but a card that remounts should not
 * even make the request: a member flicking between day tabs would otherwise
 * fire the same lookup repeatedly. Promises are cached rather than results, so
 * ten cards asking for the same place at once make one call between them.
 */
const inflight = new Map<string, Promise<PlacePhoto | null>>()

function resolve(q: string): Promise<PlacePhoto | null> {
  const key = q.trim().toLowerCase()
  let p = inflight.get(key)
  if (!p) {
    p = fetchPlacePhoto(q)
    inflight.set(key, p)
  }
  return p
}

/**
 * A photograph for a place, fetched after paint.
 *
 * Returns null until it has one, which is the point: the card draws straight
 * away with the house's own photography and quietly upgrades if Google has
 * something better. Nothing waits on this.
 */
export function usePlacePhoto(query?: string | null): PlacePhoto | null {
  const [photo, setPhoto] = useState<PlacePhoto | null>(null)

  useEffect(() => {
    if (!query?.trim()) {
      setPhoto(null)
      return
    }
    let alive = true
    void resolve(query).then((p) => {
      if (alive) setPhoto(p)
    })
    return () => {
      alive = false
    }
  }, [query])

  return photo
}
