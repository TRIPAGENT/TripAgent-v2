import { useEffect, useState } from 'react'
import { Mark, Wordmark } from '@/components/ui'

/**
 * The first moment of the app: the wordmark on ink while the opening
 * photograph arrives.
 *
 * Shown once per session and never longer than it needs to be. It is driven by
 * the hero actually loading rather than by a timer, so on a fast connection it
 * is brief and on a slow one it covers the wait instead of showing a member an
 * empty screen.
 */
export function Splash() {
  const [done, setDone] = useState(() => {
    try {
      return sessionStorage.getItem('tripagent:splash') === '1'
    } catch {
      return true
    }
  })
  const [gone, setGone] = useState(done)

  useEffect(() => {
    if (done) return
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      setDone(true)
      try {
        sessionStorage.setItem('tripagent:splash', '1')
      } catch {
        /* private mode */
      }
      window.setTimeout(() => setGone(true), 700)
    }

    /*
     * Lift when the first photograph has actually arrived, not after a fixed
     * wait. Two bounds around that:
     *
     * A short floor, because a cached hero resolves in a few milliseconds and a
     * splash that flashes for one frame reads as a glitch rather than a door.
     *
     * A ceiling, because an image that never loads — a dead CDN, a lost
     * connection — must not leave a member staring at a wordmark. The app
     * behind it handles its own missing photography.
     */
    const FLOOR_MS = 420
    const CEILING_MS = 3000
    const started = Date.now()

    const whenReady = () => {
      const wait = Math.max(0, FLOOR_MS - (Date.now() - started))
      window.setTimeout(finish, wait)
    }

    const hero = document.querySelector<HTMLImageElement>('img[data-hero], img.plate')
    if (!hero) whenReady()
    else if (hero.complete) whenReady()
    else {
      hero.addEventListener('load', whenReady, { once: true })
      hero.addEventListener('error', whenReady, { once: true })
    }

    const ceiling = window.setTimeout(finish, CEILING_MS)
    return () => window.clearTimeout(ceiling)
  }, [done])

  if (gone) return null
  return (
    <div className={`splash${done ? ' is-done' : ''}`} aria-hidden style={{ background: 'var(--ink-0)' }}>
      <span className="splash-mark c-champagne">
        <Mark size={44} strokeWidth={24} />
      </span>
      <Wordmark size={18} showMark={false} className="splash-name" />
      <span className="splash-line" />
      <span className="splash-sub t-label c-ivory-3" style={{ paddingLeft: '0.14em' }}>
        By invitation
      </span>
    </div>
  )
}
