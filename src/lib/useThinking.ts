import { useEffect, useState } from 'react'

/**
 * What Tara says while she is thinking and no tool has named itself yet.
 *
 * A bare progress bar for ninety seconds reads as a hang. These lines are the
 * language of the work — a desk consulting maps, seasons and timetables — and
 * they rotate so the screen is visibly alive.
 *
 * They are deliberately vague about *what* is being weighed, because at this
 * point nothing has been decided and claiming otherwise would be a small lie
 * told very often. The moment a tool runs, its own honest label takes over.
 */
const WORDS = [
  'Thinking it through',
  'Consulting the map',
  'Weighing the routes',
  'Checking the season',
  'Reading the guides',
  'Pacing out the days',
  'Turning it over',
  'Looking at the calendar',
  'Finding the thread',
  'Considering the detour',
]

const EVERY_MS = 2600

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
