import { useEffect, useState } from 'react'

/** Travel interludes, not claims about tools or bookings in progress. */
const WORDS = [
  'A little room for discovery',
  'Every good journey starts with a little curiosity',
  'The best days leave room for a detour',
  'Somewhere between a quiet coast and a lively city',
  'Slow mornings. Unhurried evenings.',
  'A new view, a different pace',
  'A change of scenery can change the whole day',
  'From the first hello to the last sunset',
  'A table worth lingering at. A street worth wandering.',
  'Good journeys leave a little room for surprise',
]

const EVERY_MS = 4500

/**
 * Cycles while `active`, settling back to the first line when it stops. The
 * order is rotated from a different starting point each turn so a member who
 * asks twice does not watch the same sequence twice.
 */
export function useThinkingWord(active: boolean): string {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (!active) {
      setI(0)
      return
    }
    // A different opening line each turn, without Math.random in render.
    const offset = Math.floor(Date.now() / 1000) % WORDS.length
    setI(offset)
    const timer = window.setInterval(() => setI((n) => (n + 1) % WORDS.length), EVERY_MS)
    return () => window.clearInterval(timer)
  }, [active])

  return WORDS[i] ?? WORDS[0]!
}
